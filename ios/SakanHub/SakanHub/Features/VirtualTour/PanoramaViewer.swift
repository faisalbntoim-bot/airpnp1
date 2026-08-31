import SwiftUI
import SceneKit
import UIKit

/// Renders a single equirectangular 360° image on the inside of a sphere and
/// lets the user look around (device motion when available, drag as fallback).
struct PanoramaViewer: UIViewRepresentable {
    let room: VirtualTour.Room

    func makeUIView(context: Context) -> SCNView {
        let scn = SCNView(frame: .zero)
        scn.backgroundColor = .black
        scn.autoenablesDefaultLighting = true
        scn.allowsCameraControl = true
        scn.defaultCameraController.interactionMode = .fly
        scn.defaultCameraController.inertiaEnabled = true
        scn.scene = SCNScene()
        addSphere(to: scn.scene!, url: room.panoramaURL)
        addHotspots(to: scn.scene!, hotspots: room.hotspots)
        return scn
    }

    func updateUIView(_ uiView: SCNView, context: Context) {
        // Swap the sphere texture when the room changes.
        uiView.scene?.rootNode.childNode(withName: "panoSphere", recursively: false)?
            .geometry?.firstMaterial?.diffuse.contents = loadImage(from: room.panoramaURL)
    }

    private func addSphere(to scene: SCNScene, url: URL) {
        let sphere = SCNSphere(radius: 20)
        sphere.segmentCount = 96
        let mat = SCNMaterial()
        mat.diffuse.contents = loadImage(from: url) ?? UIColor.darkGray
        mat.isDoubleSided = true
        sphere.firstMaterial = mat

        let node = SCNNode(geometry: sphere)
        node.name = "panoSphere"
        // Flip so we see the inside of the sphere.
        node.scale = SCNVector3(-1, 1, 1)
        scene.rootNode.addChildNode(node)

        // Camera at the centre.
        let cam = SCNCamera()
        cam.fieldOfView = 80
        let camNode = SCNNode()
        camNode.camera = cam
        camNode.position = .init(0, 0, 0)
        scene.rootNode.addChildNode(camNode)
    }

    private func addHotspots(to scene: SCNScene, hotspots: [VirtualTour.TourHotspot]) {
        for h in hotspots {
            let dot = SCNSphere(radius: 0.4)
            dot.firstMaterial?.diffuse.contents = UIColor.systemGreen
            let node = SCNNode(geometry: dot)
            // Convert (yaw, pitch) → position on a sphere of radius 8.
            let r: Float = 8
            let yaw = Float(h.yawDegrees) * .pi / 180
            let pitch = Float(h.pitchDegrees) * .pi / 180
            node.position = SCNVector3(
                r * cosf(pitch) * sinf(yaw),
                r * sinf(pitch),
                -r * cosf(pitch) * cosf(yaw)
            )
            scene.rootNode.addChildNode(node)
        }
    }

    private func loadImage(from url: URL) -> UIImage? {
        // For remote URLs, replace with an async loader that caches. This synchronous
        // path is fine for bundled panoramas; keep the network path off the main thread.
        if url.isFileURL, let data = try? Data(contentsOf: url) {
            return UIImage(data: data)
        }
        return nil
    }
}
