import Foundation
import Supabase

// Sube la foto a Storage e inserta la fila en `fotos`. El trigger de Supabase calcula el calibre.
enum Uploader {
    struct NuevaFoto: Encodable {
        let id: UUID
        let session_id: UUID
        let captured_at: String
        let storage_uri: String
        let lat: Double?
        let lng: Double?
        let status: String
        let fruit_count_estimate: Double
        let fruits: [Fruta]
        let capture_metadata: CaptureMetadata
        let measurement_status: String
    }

    static func subir(_ c: CapturaProcesada, sesion: UUID, usuario: UUID, lat: Double?, lng: Double?) async throws -> Foto {
        let id = UUID()
        let path = "\(usuario.uuidString.lowercased())/\(id.uuidString.lowercased()).jpg"
        try await supabase.storage.from(Config.photosBucket)
            .upload(path, data: c.jpeg, options: FileOptions(contentType: "image/jpeg", upsert: false))

        let frutas = c.fruta.map { [$0] } ?? []
        let fila = NuevaFoto(
            id: id, session_id: sesion, captured_at: c.metadata.captured_at, storage_uri: path,
            lat: lat, lng: lng, status: "listo", fruit_count_estimate: Double(frutas.count),
            fruits: frutas, capture_metadata: c.metadata, measurement_status: "unmeasured")
        try await supabase.from("fotos").insert(fila).execute()
        // Se relee para traer el calibre calculado por Supabase
        return try await Repo.foto(id)
    }
}
