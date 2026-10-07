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
      guard AVCaptureDevice.default(.builtInTrueDepthCamera, for: .video, position: .front) != nil else {
        promise.reject("DEPTH_UNSUPPORTED", "Este teléfono no entrega profundidad frontal compatible.")
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
