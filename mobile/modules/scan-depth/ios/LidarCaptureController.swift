import ARKit
import AVFoundation
import CoreImage
import SceneKit
import UIKit

// A capture protocol, not a claim of sensor accuracy or validated fruit sizing.
private struct LidarDistanceGate {
  static let targetM = 0.40
  static let toleranceM = 0.01
  static let holdSeconds = 0.8
  static let maximumSpanM = 0.008
  private var readings: [(time: TimeInterval, distance: Double)] = []
  var stableDuration: TimeInterval {
    guard let first = readings.first, let last = readings.last else { return 0 }
    return last.time - first.time
  }
  var spanM: Double {
    let values = readings.map { $0.distance }
    return (values.max() ?? 0) - (values.min() ?? 0)
  }
  mutating func reset() { readings.removeAll() }
  mutating func observe(_ distance: Double?, at time: TimeInterval) -> Bool {
    guard let distance, distance.isFinite, time.isFinite,
          abs(distance - Self.targetM) <= Self.toleranceM + 0.000001 else {
      reset(); return false
    }
    if let last = readings.last {
      if time < last.time || time - last.time > 0.35 { reset() }
      else if time == last.time { return isStable }
    }
    readings.append((time, distance))
    readings.removeAll { time - $0.time > 1.05 }
    // Movement starts a new hold instead of keeping an old green state.
    if spanM > Self.maximumSpanM { readings = [(time, distance)] }
    return isStable
  }
  private var isStable: Bool {
    readings.count >= 6 && stableDuration >= Self.holdSeconds && spanM <= Self.maximumSpanM
  }
}

// The JPEG and metric depth always come from the same ARFrame. No GPS or
// world-space camera pose is exported. Portrait pixels are rotated clockwise.
final class LidarCaptureController: UIViewController, ARSessionDelegate {
  private let cameraView = ARSCNView()
  private let status = UILabel()
  private let captureButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)
  private let crosshair = UILabel()
  private let context = CIContext()
  private let processing = DispatchQueue(label: "com.rimonim.lidar.export")
  private var completion: (([String: Any]?, String?) -> Void)?
  private var finished = false
  private var lastUpdate: TimeInterval = 0
  private var readyFrame: ARFrame?
  private var readyAtUptime: TimeInterval = 0
  private var distanceGate = LidarDistanceGate()
  private var exporting = false

  init(completion: @escaping ([String: Any]?, String?) -> Void) {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    cameraView.session.delegate = self
    view.addSubview(cameraView)
    status.numberOfLines = 0
    status.textAlignment = .center
    status.textColor = .white
    status.backgroundColor = UIColor.black.withAlphaComponent(0.75)
    status.text = "LiDAR trasero · Iniciando…\nUna granada inmóvil, de frente y con buena luz."
    captureButton.setTitle("Buscá 40 cm para tomar la foto", for: .normal)
    captureButton.backgroundColor = .systemGreen
    captureButton.setTitleColor(.black, for: .normal)
    captureButton.layer.cornerRadius = 12
    captureButton.isEnabled = false
    captureButton.addTarget(self, action: #selector(takePhoto), for: .touchUpInside)
    cancelButton.setTitle("Cancelar", for: .normal)
    cancelButton.setTitleColor(.white, for: .normal)
    cancelButton.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    for item in [status, captureButton, cancelButton] { view.addSubview(item) }
    crosshair.text = "+"
    crosshair.textColor = .white
    crosshair.textAlignment = .center
    crosshair.font = .systemFont(ofSize: 32, weight: .light)
    crosshair.isUserInteractionEnabled = false
    view.addSubview(crosshair)
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: UIApplication.willResignActiveNotification, object: nil)
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: start()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
        DispatchQueue.main.async {
          if allowed { self?.start() } else { self?.finish(nil, "Permití la cámara en Ajustes del teléfono.") }
        }
      }
    default: finish(nil, "Permití la cámara en Ajustes del teléfono.")
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    cameraView.frame = view.bounds
    let safe = view.safeAreaInsets
    crosshair.frame = CGRect(x: view.bounds.midX - 20, y: view.bounds.midY - 20, width: 40, height: 40)
    status.frame = CGRect(x: 16, y: safe.top + 12, width: view.bounds.width - 32, height: 145)
    captureButton.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 114, width: view.bounds.width - 48, height: 52)
    cancelButton.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 56, width: view.bounds.width - 48, height: 44)
  }

  private func start() {
    guard !finished else { return }
    let config = ARWorldTrackingConfiguration()
    config.frameSemantics = .sceneDepth
    cameraView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard frame.timestamp - lastUpdate > 0.15 else { return }
    lastUpdate = frame.timestamp
    let trackingOK: Bool
    if case .normal = frame.camera.trackingState { trackingOK = true } else { trackingOK = false }
    DispatchQueue.main.async { [weak self] in
      guard let self, !self.finished, !self.exporting else { return }
      self.readyFrame = nil
      self.captureButton.isEnabled = false
      self.captureButton.backgroundColor = .darkGray
      self.crosshair.textColor = .white
      if trackingOK && frame.sceneDepth != nil {
        if let distance = self.centerDistance(frame) {
          let stable = self.distanceGate.observe(distance, at: frame.timestamp)
          let guidance = distance < LidarDistanceGate.targetM - LidarDistanceGate.toleranceM ? "Alejá el teléfono hasta 40 cm." : distance > LidarDistanceGate.targetM + LidarDistanceGate.toleranceM ? "Acercá el teléfono hasta 40 cm." : stable ? "Distancia estable. Podés tomar la foto." : "Mantené inmóviles el teléfono y la fruta (0,8 s)."
          self.readyFrame = stable ? frame : nil
          self.readyAtUptime = stable ? ProcessInfo.processInfo.systemUptime : 0
          self.captureButton.isEnabled = stable
          self.captureButton.backgroundColor = stable ? .systemGreen : .darkGray
          self.crosshair.textColor = stable ? .systemGreen : .white
          self.captureButton.setTitle(stable ? "Tomar foto · objetivo 40 cm" : "Buscá 40 cm y mantené inmóvil", for: .normal)
          let measured = String(format: "%.1f", distance * 100)
          self.status.text = "Objetivo: 40 cm · margen de captura ±1 cm\nLiDAR al centro: ≈\(measured) cm\n\(guidance)\n+ sobre la fruta, no el fondo. Calibre experimental."
        } else {
          self.distanceGate.reset()
          self.captureButton.setTitle("Esperando distancia fiable", for: .normal)
          self.status.text = "LiDAR · Sin distancia fiable al centro\nCentrar la fruta en +, mejorar la luz y mantenerla inmóvil."
        }
      } else {
        self.distanceGate.reset()
        self.captureButton.setTitle("Preparando LiDAR…", for: .normal)
        self.status.text = "Preparando LiDAR…\nMové el teléfono suavemente y buscá buena luz."
      }
    }
  }

  // Map the visible reticle through ARKit's crop/orientation transform, rather
  // than assuming the preview center is the depth grid's optical center.
  private func centerDistance(_ frame: ARFrame) -> Double? {
    guard cameraView.bounds.width > 0, cameraView.bounds.height > 0,
          let depth = frame.sceneDepth, let confidence = depth.confidenceMap else { return nil }
    let point = CGPoint(x: 0.5, y: 0.5).applying(frame.displayTransform(for: .portrait, viewportSize: cameraView.bounds.size).inverted())
    guard point.x >= 0, point.x < 1, point.y >= 0, point.y < 1 else { return nil }
    let map = depth.depthMap
    let width = CVPixelBufferGetWidth(map), height = CVPixelBufferGetHeight(map)
    guard width > 0, height > 0, CVPixelBufferGetWidth(confidence) == width,
          CVPixelBufferGetHeight(confidence) == height else { return nil }
    CVPixelBufferLockBaseAddress(map, .readOnly)
    CVPixelBufferLockBaseAddress(confidence, .readOnly)
    defer {
      CVPixelBufferUnlockBaseAddress(map, .readOnly)
      CVPixelBufferUnlockBaseAddress(confidence, .readOnly)
    }
    guard let base = CVPixelBufferGetBaseAddress(map), let levels = CVPixelBufferGetBaseAddress(confidence) else { return nil }
    let x = Int(point.x * CGFloat(width)), y = Int(point.y * CGFloat(height))
    var values: [Double] = []
    for rowIndex in max(0, y - 2)...min(height - 1, y + 2) {
      let row = base.advanced(by: rowIndex * CVPixelBufferGetBytesPerRow(map)).assumingMemoryBound(to: Float32.self)
      let conf = levels.advanced(by: rowIndex * CVPixelBufferGetBytesPerRow(confidence)).assumingMemoryBound(to: UInt8.self)
      for column in max(0, x - 2)...min(width - 1, x + 2) {
        let z = Double(row[column])
        if conf[column] == 2 && z.isFinite && z >= 0.15 && z <= 1.5 { values.append(z) }
      }
    }
    guard values.count >= 9 else { return nil }
    values.sort()
    let median = values[values.count / 2]
    // Reject a reticle straddling foreground/background rather than showing
    // a plausible but misleading average distance.
    guard values[values.count * 4 / 5] - values[values.count / 5] <= 0.04 else { return nil }
    return median
  }

  @objc private func takePhoto() {
    guard !finished, !exporting, let ready = readyFrame,
          ProcessInfo.processInfo.systemUptime - readyAtUptime < 0.35,
          let frame = cameraView.session.currentFrame,
          frame.timestamp - ready.timestamp >= 0,
          frame.timestamp - ready.timestamp < 0.25 else { return }
    // Recheck the actual shutter frame. Never export a previous in-range frame
    // after the user has moved away from the capture distance.
    guard case .normal = frame.camera.trackingState,
          let distance = centerDistance(frame),
          distanceGate.observe(distance, at: frame.timestamp) else {
      readyFrame = nil
      captureButton.isEnabled = false
      captureButton.backgroundColor = .darkGray
      crosshair.textColor = .white
      status.text = "La distancia cambió. Volvé a 40 cm y mantené inmóvil."
      return
    }
    exporting = true
    captureButton.isEnabled = false
    readyFrame = nil
    cameraView.session.pause()
    status.text = "Guardando foto y profundidad…"
    let captureProtocol: [String: Any] = ["id": "lidar-front-40cm-v1", "version": 1,
      "target_distance_m": LidarDistanceGate.targetM, "tolerance_m": LidarDistanceGate.toleranceM,
      "measured_distance_m": distance, "distance_reference": "camera-plane-to-surface-at-reticle",
      "required_hold_s": LidarDistanceGate.holdSeconds, "stable_duration_s": distanceGate.stableDuration,
      "stability_span_m": distanceGate.spanM, "maximum_stability_span_m": LidarDistanceGate.maximumSpanM,
      "range_verified": true, "precision_validation": "pending-physical-comparison"]
    processing.async { [weak self] in
      guard let self else { return }
      do {
        let image = CIImage(cvPixelBuffer: frame.capturedImage).oriented(.right)
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpeg = self.context.jpegRepresentation(of: image, colorSpace: colorSpace, options: [:]),
              var metadata = self.depthMetadata(frame) else {
          throw NSError(domain: "lidar", code: 1, userInfo: [NSLocalizedDescriptionKey: "No se pudo registrar la profundidad. Reintentá."])
        }
        metadata["distanceM"] = distance
        metadata["capture_protocol"] = captureProtocol
        let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = cache.appendingPathComponent("lidar-\(UUID().uuidString).jpg")
        try jpeg.write(to: url, options: .atomic)
        DispatchQueue.main.async {
          guard !self.finished else { try? FileManager.default.removeItem(at: url); return }
          self.finish(["uri": url.absoluteString, "depthCapture": metadata], nil)
        }
      } catch { DispatchQueue.main.async { self.finish(nil, error.localizedDescription) } }
    }
  }

  private func depthMetadata(_ frame: ARFrame) -> [String: Any]? {
    guard let depth = frame.sceneDepth, let confidence = depth.confidenceMap else { return nil }
    let map = depth.depthMap
    let width = CVPixelBufferGetWidth(map), height = CVPixelBufferGetHeight(map)
    guard width > 0, height > 0, width * height <= 100000,
          CVPixelBufferGetWidth(confidence) == width,
          CVPixelBufferGetHeight(confidence) == height else { return nil }
    CVPixelBufferLockBaseAddress(map, .readOnly)
    CVPixelBufferLockBaseAddress(confidence, .readOnly)
    defer {
      CVPixelBufferUnlockBaseAddress(map, .readOnly)
      CVPixelBufferUnlockBaseAddress(confidence, .readOnly)
    }
    guard let base = CVPixelBufferGetBaseAddress(map), let confidenceBase = CVPixelBufferGetBaseAddress(confidence) else { return nil }
    var millimeters = [Int](repeating: 0, count: width * height)
    var levels = [Int](repeating: 0, count: width * height)
    for y in 0..<height {
      let row = base.advanced(by: y * CVPixelBufferGetBytesPerRow(map)).assumingMemoryBound(to: Float32.self)
      let conf = confidenceBase.advanced(by: y * CVPixelBufferGetBytesPerRow(confidence)).assumingMemoryBound(to: UInt8.self)
      for x in 0..<width {
        // (x,y) -> (height-1-y,x), matching the clockwise JPEG rotation.
        let index = x * height + height - 1 - y
        let z = row[x]
        millimeters[index] = z.isFinite && z >= 0.15 && z <= 1.5 ? Int((z * 1000).rounded()) : 0
        levels[index] = Int(conf[x])
      }
    }
    let imageWidth = Float(CVPixelBufferGetWidth(frame.capturedImage))
    let imageHeight = Float(CVPixelBufferGetHeight(frame.capturedImage))
    let k = frame.camera.intrinsics
    // Scale intrinsics to the original depth grid, then rotate the optical center.
    let fx = k.columns.0.x * Float(width) / imageWidth
    let fy = k.columns.1.y * Float(height) / imageHeight
    let cx = k.columns.2.x * Float(width) / imageWidth
    let cy = k.columns.2.y * Float(height) / imageHeight
    return ["version": 1, "source": "arkit-scene-depth", "orientation": "portrait-clockwise",
            "width": height, "height": width, "depth_mm": millimeters, "confidence": levels,
            "intrinsics": ["fx": fy, "fy": fx, "cx": Float(height - 1) - cy, "cy": cx],
            "image_width": Int(imageHeight), "image_height": Int(imageWidth),
            "captured_at": ISO8601DateFormatter().string(from: Date()), "validation": "experimental"]
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    DispatchQueue.main.async { self.finish(nil, "No se pudo iniciar LiDAR. Volvé a abrir la captura.") }
  }
  func sessionWasInterrupted(_ session: ARSession) {
    DispatchQueue.main.async { self.finish(nil, "Se interrumpió LiDAR. Volvé a abrir la captura.") }
  }
  @objc private func cancelCapture() { finish(nil, nil) }
  @objc private func interrupted() { finish(nil, "Se interrumpió la cámara. Volvé a abrir la captura.") }
  private func finish(_ result: [String: Any]?, _ error: String?) {
    guard !finished else { return }
    finished = true
    NotificationCenter.default.removeObserver(self)
    cameraView.session.pause()
    let callback = completion
    completion = nil
    dismiss(animated: true) { callback?(result, error) }
  }
}
