import AVFoundation
import UIKit

// Rear-camera photographs carry no assumed distance or metric diameter.
// Keep the existing module interface so the web capture bridge stays compatible.
final class DepthCaptureController: UIViewController, AVCapturePhotoCaptureDelegate {
  private let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "com.rimonim.scanrimonim.camera")
  private let photoOutput = AVCapturePhotoOutput()
  private var preview: AVCaptureVideoPreviewLayer?
  private let status = UILabel()
  private let guide = UIView()
  private let capture = UIButton(type: .system)
  private let cancel = UIButton(type: .system)
  private var completion: (([String: Any]?, String?) -> Void)?
  // Session lifecycle lives on queue; UI and completion live on main.
  private var stopped = false
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
    status.text = "Cámara trasera\nCentrar una sola granada y mantenerla enfocada."
    guide.layer.borderWidth = 3
    guide.layer.borderColor = UIColor.white.cgColor
    guide.layer.cornerRadius = 12
    guide.isUserInteractionEnabled = false
    capture.setTitle("Tomar foto", for: .normal)
    capture.accessibilityLabel = "Tomar foto con la cámara trasera"
    capture.backgroundColor = .systemGreen
    capture.setTitleColor(.black, for: .normal)
    capture.layer.cornerRadius = 12
    capture.isEnabled = false
    capture.addTarget(self, action: #selector(takePhoto), for: .touchUpInside)
    cancel.setTitle("Cancelar", for: .normal)
    cancel.setTitleColor(.white, for: .normal)
    cancel.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    for item in [status, guide, capture, cancel] { view.addSubview(item) }
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
    preview?.frame = view.bounds
    let safe = view.safeAreaInsets
    status.frame = CGRect(x: 16, y: safe.top + 12, width: view.bounds.width - 32, height: 100)
    let side = min(view.bounds.width - 48, 280)
    guide.frame = CGRect(x: view.bounds.midX - side / 2, y: view.bounds.midY - side / 2, width: side, height: side)
    capture.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 114, width: view.bounds.width - 48, height: 52)
    cancel.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 56, width: view.bounds.width - 48, height: 44)
  }

  private func orient(_ connection: AVCaptureConnection?) {
    guard let connection else { return }
    if #available(iOS 17.0, *) {
      if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
    } else if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = false
    }
  }

  private func configure() {
    queue.async { [weak self] in
      guard let self, !self.stopped else { return }
      do {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
          throw NSError(domain: "camera", code: 1, userInfo: [NSLocalizedDescriptionKey: "La cámara trasera no está disponible."])
        }
        let input = try AVCaptureDeviceInput(device: device)
        self.session.beginConfiguration()
        do {
          defer { self.session.commitConfiguration() }
          self.session.sessionPreset = .photo
          guard self.session.canAddInput(input), self.session.canAddOutput(self.photoOutput) else {
            throw NSError(domain: "camera", code: 2, userInfo: [NSLocalizedDescriptionKey: "No se puede configurar la cámara trasera."])
          }
          self.session.addInput(input)
          self.session.addOutput(self.photoOutput)
          try device.lockForConfiguration()
          if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
          if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
          device.unlockForConfiguration()
          self.orient(self.photoOutput.connection(with: .video))
        }
        self.session.startRunning()
        DispatchQueue.main.async {
          guard !self.finished else { return }
          NotificationCenter.default.addObserver(self, selector: #selector(self.interrupted), name: UIApplication.willResignActiveNotification, object: nil)
          let layer = AVCaptureVideoPreviewLayer(session: self.session)
          layer.videoGravity = .resizeAspect
          self.orient(layer.connection)
          self.preview = layer
          self.view.layer.insertSublayer(layer, at: 0)
          self.view.setNeedsLayout()
          self.capture.isEnabled = true
        }
      } catch {
        DispatchQueue.main.async { self.finish(nil, error.localizedDescription) }
      }
    }
  }

  @objc private func takePhoto() {
    guard !finished, capture.isEnabled else { return }
    capture.isEnabled = false
    capture.setTitle("Guardando foto…", for: .normal)
    queue.async {
      guard !self.stopped, self.session.isRunning else { return }
      let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
      self.photoOutput.capturePhoto(with: settings, delegate: self)
    }
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    if let error {
      DispatchQueue.main.async { self.finish(nil, error.localizedDescription) }
      return
    }
    guard let data = photo.fileDataRepresentation() else {
      DispatchQueue.main.async { self.finish(nil, "No se pudo guardar la foto.") }
      return
    }
    do {
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("rear-\(UUID().uuidString).jpg")
      try data.write(to: url, options: .atomic)
      DispatchQueue.main.async {
        guard !self.finished else { try? FileManager.default.removeItem(at: url); return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        self.finish(["uri": url.absoluteString, "capturedAt": ISO8601DateFormatter().string(from: Date())], nil)
      }
    } catch {
      DispatchQueue.main.async { self.finish(nil, "No se pudo guardar la foto en el teléfono.") }
    }
  }

  @objc private func cancelCapture() { finish(nil, nil) }
  @objc private func interrupted() { finish(nil, "Se interrumpió la cámara. Volvé a abrir la captura.") }
  @objc private func runtimeError() { finish(nil, "La cámara no pudo continuar. Volvé a abrir la captura.") }

  private func finish(_ result: [String: Any]?, _ error: String?) {
    guard !finished else { return }
    finished = true
    NotificationCenter.default.removeObserver(self)
    queue.async { self.stopped = true; self.session.stopRunning() }
    let callback = completion
    completion = nil
    dismiss(animated: true) { callback?(result, error) }
  }
}
