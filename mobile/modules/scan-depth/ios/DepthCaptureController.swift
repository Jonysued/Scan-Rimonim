import AVFoundation
import CoreImage
import UIKit

// Experimental: measures the central surface, not every fruit's equatorial plane.
// No assumed distance, rear-camera fallback, or manual calibration is used here.
final class DepthCaptureController: UIViewController, AVCaptureDataOutputSynchronizerDelegate {
  private let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "com.rimonim.scanrimonim.depth")
  private let video = AVCaptureVideoDataOutput()
  private let depth = AVCaptureDepthDataOutput()
  private var synchronizer: AVCaptureDataOutputSynchronizer?
  private var preview: AVCaptureVideoPreviewLayer?
  private let context = CIContext()
  private let speech = AVSpeechSynthesizer()
  private let status = UILabel()
  private let guide = UIView()
  private let start = UIButton(type: .system)
  private let cancel = UIButton(type: .system)
  private var completion: (([String: Any]?, String?) -> Void)?
  // All measurement/capture state lives on queue; UI and completion live on main.
  private var armed = false
  private var captured = false
  private var stableSince: Double?
  private var lastTimestamp: Double?
  private var stableDistances: [Float] = []
  private var lastAnnouncement = -Double.infinity
  private var finished = false

  init(completion: @escaping ([String: Any]?, String?) -> Void) {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    status.textColor = .white
    status.backgroundColor = UIColor.black.withAlphaComponent(0.7)
    status.numberOfLines = 0
    status.textAlignment = .center
    status.font = .systemFont(ofSize: 19, weight: .semibold)
    status.text = "Cámara frontal · poné una sola fruta en el centro.\nOrientá la pantalla hacia la fruta.\nLa distancia se leerá automáticamente."
    guide.layer.borderWidth = 3
    guide.layer.borderColor = UIColor.white.cgColor
    guide.layer.cornerRadius = 12
    guide.isUserInteractionEnabled = false
    start.setTitle("Iniciar captura automática", for: .normal)
    start.backgroundColor = .systemGreen
    start.setTitleColor(.black, for: .normal)
    start.layer.cornerRadius = 12
    start.addTarget(self, action: #selector(armCapture), for: .touchUpInside)
    cancel.setTitle("Cancelar", for: .normal)
    cancel.setTitleColor(.white, for: .normal)
    cancel.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    for item in [status, guide, start, cancel] { view.addSubview(item) }
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: .AVCaptureSessionWasInterrupted, object: session)
    NotificationCenter.default.addObserver(self, selector: #selector(runtimeError), name: .AVCaptureSessionRuntimeError, object: session)
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: configure()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        if granted { self?.configure() }
        else { DispatchQueue.main.async { self?.finish(nil, "Permití la cámara en Ajustes del teléfono.") } }
      }
    default: finish(nil, "Permití la cámara en Ajustes del teléfono.")
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    // Aspect fit avoids cropping: the central guide maps to the sensor centre.
    preview?.frame = view.bounds
    let safe = view.safeAreaInsets
    status.frame = CGRect(x: 16, y: safe.top + 12, width: view.bounds.width - 32, height: 124)
    guide.frame = CGRect(x: view.bounds.midX - 28, y: view.bounds.midY - 28, width: 56, height: 56)
    start.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 114, width: view.bounds.width - 48, height: 52)
    cancel.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 56, width: view.bounds.width - 48, height: 44)
  }

  private func configure() {
    queue.async { [weak self] in
      guard let self, !self.captured else { return }
      do {
        guard let device = AVCaptureDevice.default(.builtInTrueDepthCamera, for: .video, position: .front) else {
          throw NSError(domain: "depth", code: 1, userInfo: [NSLocalizedDescriptionKey: "TrueDepth no está disponible."])
        }
        let input = try AVCaptureDeviceInput(device: device)
        self.session.beginConfiguration()
        defer { self.session.commitConfiguration() }
        self.session.sessionPreset = .inputPriority
        guard self.session.canAddInput(input), self.session.canAddOutput(self.video), self.session.canAddOutput(self.depth) else {
          throw NSError(domain: "depth", code: 2, userInfo: [NSLocalizedDescriptionKey: "No se puede configurar la profundidad."])
        }
        self.session.addInput(input)
        // Prefer a moderate video resolution with a supported depth stream.
        let formats = device.formats.filter {
          let size = CMVideoFormatDescriptionGetDimensions($0.formatDescription)
          return !($0.supportedDepthDataFormats.isEmpty) && size.width <= 1920 && $0.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= 15 && $0.maxFrameRate >= 15 }
        }
        guard let format = formats.max(by: {
          CMVideoFormatDescriptionGetDimensions($0.formatDescription).width < CMVideoFormatDescriptionGetDimensions($1.formatDescription).width
        }), let depthFormat = format.supportedDepthDataFormats.filter({
          CMFormatDescriptionGetMediaSubType($0.formatDescription) == kCVPixelFormatType_DepthFloat32 && $0.videoSupportedFrameRateRanges.contains { $0.minFrameRate <= 15 && $0.maxFrameRate >= 15 }
        }).max(by: {
          CMVideoFormatDescriptionGetDimensions($0.formatDescription).width < CMVideoFormatDescriptionGetDimensions($1.formatDescription).width
        }) else {
          throw NSError(domain: "depth", code: 3, userInfo: [NSLocalizedDescriptionKey: "La cámara no ofrece profundidad en metros compatible."])
        }
        try device.lockForConfiguration()
        device.activeFormat = format
        device.activeDepthDataFormat = depthFormat
        device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 15)
        device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 15)
        device.unlockForConfiguration()
        self.video.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        self.video.alwaysDiscardsLateVideoFrames = true
        self.depth.isFilteringEnabled = false // Don't fill holes with inferred depth.
        self.session.addOutput(self.video)
        self.session.addOutput(self.depth)
        for connection in [self.video.connection(with: .video), self.depth.connection(with: .depthData)] {
          if let connection {
            if #available(iOS 17.0, *) {
              if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            } else if connection.isVideoOrientationSupported {
              connection.videoOrientation = .portrait
            }
            if connection.isVideoMirroringSupported { connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = false }
          }
        }
        self.synchronizer = AVCaptureDataOutputSynchronizer(dataOutputs: [self.video, self.depth])
        self.synchronizer?.setDelegate(self, queue: self.queue)
        DispatchQueue.main.async {
          guard !self.finished else { return }
          NotificationCenter.default.addObserver(self, selector: #selector(self.interrupted), name: UIApplication.willResignActiveNotification, object: nil)
          let layer = AVCaptureVideoPreviewLayer(session: self.session)
          layer.videoGravity = .resizeAspect
          if let connection = layer.connection {
            if #available(iOS 17.0, *) {
              if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            } else if connection.isVideoOrientationSupported {
              connection.videoOrientation = .portrait
            }
            if connection.isVideoMirroringSupported { connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = false }
          }
          self.preview = layer
          self.view.layer.insertSublayer(layer, at: 0)
          self.view.setNeedsLayout()
        }
        // Enqueued after commitConfiguration (defer) on the same serial queue.
        self.queue.async { if !self.captured { self.session.startRunning() } }
      } catch {
        DispatchQueue.main.async { self.finish(nil, error.localizedDescription) }
      }
    }
  }

  @objc private func armCapture() {
    start.isEnabled = false
    start.setTitle("Escuchá la guía; la foto se toma sola", for: .normal)
    speak("Orientá la cámara frontal hacia una sola fruta, centrada. Escuchá la distancia.")
    queue.async { self.armed = true; self.resetStability() }
  }
  @objc private func cancelCapture() { finish(nil, nil) }
  @objc private func interrupted() { finish(nil, "Se interrumpió la cámara. Volvé a abrir la captura.") }
  @objc private func runtimeError() { finish(nil, "La cámara no pudo continuar. Volvé a abrir la captura.") }

  private func resetStability() { stableSince = nil; stableDistances.removeAll(); lastTimestamp = nil }

  func dataOutputSynchronizer(_ synchronizer: AVCaptureDataOutputSynchronizer, didOutput data: AVCaptureSynchronizedDataCollection) {
    guard !captured else { return }
    guard let d = data.synchronizedData(for: depth) as? AVCaptureSynchronizedDepthData,
      let v = data.synchronizedData(for: video) as? AVCaptureSynchronizedSampleBufferData,
      !d.depthDataWasDropped, !v.sampleBufferWasDropped,
      d.depthData.depthDataAccuracy == .absolute,
      let imageBuffer = CMSampleBufferGetImageBuffer(v.sampleBuffer) else {
      resetStability(); report("Buscando una lectura de profundidad válida", time: CACurrentMediaTime(), ready: false); return
    }
    let converted = d.depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)
    let buffer = converted.depthDataMap
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { resetStability(); return }
    let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
    let stride = CVPixelBufferGetBytesPerRow(buffer) / MemoryLayout<Float>.size
    let pixels = base.assumingMemoryBound(to: Float.self)
    let rx = max(2, width / 40), ry = max(2, height / 40)
    var values: [Float] = []
    for y in (height / 2 - ry)...(height / 2 + ry) {
      for x in (width / 2 - rx)...(width / 2 + rx) {
        let value = pixels[y * stride + x]
        if value.isFinite && value >= 0.15 && value <= 1.5 { values.append(value) }
      }
    }
    let total = (rx * 2 + 1) * (ry * 2 + 1)
    let timestamp = CMTimeGetSeconds(v.timestamp)
    guard Double(values.count) / Double(total) >= 0.8 else {
      resetStability(); report("Centrar la fruta; lectura insuficiente", time: timestamp, ready: false); return
    }
    values.sort()
    let median = values[values.count / 2]
    let spread = values[values.count * 9 / 10] - values[values.count / 10]
    guard spread <= 0.025 else {
      resetStability(); report("Centrar una sola superficie", time: timestamp, ready: false); return
    }
    let inRange = median >= 0.37 && median <= 0.43
    let instruction = inRange ? "Distancia en rango · mantené quieto" : median < 0.37 ? "Alejá el teléfono" : "Acercá el teléfono"
    report("\(instruction) · \(Int((median * 100).rounded())) cm", time: timestamp, ready: inRange)
    guard armed && inRange else { resetStability(); return }
    if let previous = lastTimestamp, timestamp <= previous || timestamp - previous > 0.2 { resetStability() }
    lastTimestamp = timestamp
    if stableSince == nil { stableSince = timestamp }
    stableDistances.append(median)
    if let min = stableDistances.min(), let max = stableDistances.max(), max - min > 0.01 {
      stableSince = timestamp; stableDistances = [median]
    }
    guard let began = stableSince, timestamp - began >= 1.0, stableDistances.count >= 12 else { return }
    // Save the colour frame paired with this depth sample, never a later frame.
    captured = true
    let image = CIImage(cvPixelBuffer: imageBuffer)
    guard let cg = context.createCGImage(image, from: image.extent),
      let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.88) else {
      DispatchQueue.main.async { self.finish(nil, "No se pudo guardar la foto.") }; return
    }
    do {
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("depth-\(UUID().uuidString).jpg")
      try jpeg.write(to: url, options: .atomic)
      var geometry: [String: Any] = [
        "status": "experimental-unvalidated", "imageWidth": cg.width, "imageHeight": cg.height,
        "depthWidth": width, "depthHeight": height, "imageOrientation": "sensor-native",
        "distanceTarget": "central-surface", "metricDiameterAvailable": false
      ]
      if let calibration = d.depthData.cameraCalibrationData {
        let matrix = calibration.intrinsicMatrix
        geometry["intrinsicsColumnMajor"] = [
          Double(matrix.columns.0.x), Double(matrix.columns.0.y), Double(matrix.columns.0.z),
          Double(matrix.columns.1.x), Double(matrix.columns.1.y), Double(matrix.columns.1.z),
          Double(matrix.columns.2.x), Double(matrix.columns.2.y), Double(matrix.columns.2.z)
        ]
        geometry["intrinsicReferenceWidth"] = Double(calibration.intrinsicMatrixReferenceDimensions.width)
        geometry["intrinsicReferenceHeight"] = Double(calibration.intrinsicMatrixReferenceDimensions.height)
      }
      let result: [String: Any] = ["uri": url.absoluteString, "width": cg.width, "height": cg.height,
        "capturedAt": ISO8601DateFormatter().string(from: Date()),
        "depthCapture": ["version": 1, "method": "truedepth-front", "distanceM": (Double(median) * 1_000_000).rounded() / 1_000_000,
          "targetM": 0.4, "toleranceM": 0.03, "stableDurationMs": Int((timestamp - began) * 1000),
          "validFraction": Double(values.count) / Double(total), "spreadM": (Double(spread) * 1_000_000).rounded() / 1_000_000,
          "region": "center", "validation": "experimental", "geometry": geometry]]
      DispatchQueue.main.async {
        self.speak("Foto tomada")
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        self.finish(result, nil)
      }
    } catch { DispatchQueue.main.async { self.finish(nil, "No se pudo guardar la foto en el teléfono.") } }
  }

  private func report(_ message: String, time: Double, ready: Bool) {
    let announce = armed && time - lastAnnouncement >= 2.5
    if announce { lastAnnouncement = time }
    DispatchQueue.main.async {
      guard !self.finished else { return }
      self.status.text = "Cámara frontal · superficie central\n\(message)\nPrueba de distancia; calibre pendiente de validación"
      self.guide.layer.borderColor = (ready ? UIColor.systemGreen : UIColor.white).cgColor
      if announce { self.speak(message) }
    }
  }
  private func speak(_ message: String) {
    if speech.isSpeaking { return }
    let utterance = AVSpeechUtterance(string: message)
    utterance.voice = AVSpeechSynthesisVoice(language: "es-AR")
    speech.speak(utterance)
  }
  private func finish(_ result: [String: Any]?, _ error: String?) {
    guard !finished else { return }
    finished = true
    NotificationCenter.default.removeObserver(self)
    speech.stopSpeaking(at: .immediate)
    queue.async { self.captured = true; self.armed = false; self.session.stopRunning(); self.synchronizer?.setDelegate(nil, queue: nil) }
    let callback = completion
    completion = nil
    dismiss(animated: true) { callback?(result, error) }
  }
}
