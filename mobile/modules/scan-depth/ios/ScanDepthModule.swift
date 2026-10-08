import ExpoModulesCore
import AVFoundation
import UIKit

public class ScanDepthModule: Module {
  private var activeCapture: DepthCaptureController?

  public func definition() -> ModuleDefinition {
    Name("ScanDepth")
    AsyncFunction("capture") { (promise: Promise) in
      guard self.activeCapture == nil else {
        promise.reject("CAPTURE_BUSY", "Ya hay una captura abierta.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("NO_VIEW", "No se pudo abrir la cámara.")
        return
      }
      guard AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) != nil else {
        promise.reject("CAMERA_UNSUPPORTED", "La cámara trasera no está disponible.")
        return
      }
      let controller = DepthCaptureController { result, error in
        self.activeCapture = nil
        if let error { promise.reject("DEPTH_CAPTURE", error) }
        else { promise.resolve(result) }
      }
      self.activeCapture = controller
      controller.modalPresentationStyle = .fullScreen
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
  }
}
