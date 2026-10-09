import ExpoModulesCore
import AVFoundation
import UIKit
import ARKit

public class ScanDepthModule: Module {
  private var activeCapture: UIViewController?

  public func definition() -> ModuleDefinition {
    Name("ScanDepth")
    Function("newId") { UUID().uuidString.lowercased() }
    AsyncFunction("writeOfflineJSON") { (name: String, contents: String) in
      guard name.range(of: "^[a-zA-Z0-9-]+\\.json$", options: .regularExpression) != nil else {
        throw NSError(domain: "ScanOffline", code: 1)
      }
      let documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      var directory = documents.appendingPathComponent("ScanOffline", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try directory.setResourceValues(values)
      try Data(contents.utf8).write(to: directory.appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
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
      let callback: ([String: Any]?, String?) -> Void = { result, error in
        self.activeCapture = nil
        if let error { promise.reject("DEPTH_CAPTURE", error) }
        else { promise.resolve(result) }
      }
      let controller: UIViewController = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
        ? LidarCaptureController(completion: callback)
        : DepthCaptureController(completion: callback)
      self.activeCapture = controller
      controller.modalPresentationStyle = .fullScreen
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
  }
}
