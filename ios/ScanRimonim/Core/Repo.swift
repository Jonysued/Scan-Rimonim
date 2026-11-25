import Foundation
import Supabase

// Acceso a datos. Nunca se lee capture_metadata (pesa ~0,5 MB por foto).
enum Repo {
    static let fotoCols = "id,created_date,created_by,session_id,captured_at,storage_uri,lat,lng,status,fruit_count_estimate,avg_diameter_mm,fruits,measurement_status"

    // MARK: Catálogos
    static func fincas() async throws -> [Finca] {
        try await supabase.from("fincas").select().order("name").execute().value
    }
    static func variedades() async throws -> [Variedad] {
        try await supabase.from("variedades").select().order("name").execute().value
    }
    static func bloques() async throws -> [Bloque] {
        try await supabase.from("bloques").select().order("name").execute().value
    }
    static func clases() async throws -> [ClaseComercial] {
        try await supabase.from("clases_comerciales").select().order("order").execute().value
    }
    static func metas() async throws -> [MetaBloque] {
        try await supabase.from("metas_bloque").select().execute().value
    }

    // MARK: Sesiones y fotos
    static func sesiones(limit: Int = 500) async throws -> [Sesion] {
        try await supabase.from("sesiones").select().order("created_date", ascending: false).limit(limit).execute().value
    }
    static func sesion(_ id: UUID) async throws -> Sesion {
        try await supabase.from("sesiones").select().eq("id", value: id).single().execute().value
    }
    static func fotos(sesion: UUID) async throws -> [Foto] {
        try await supabase.from("fotos").select(fotoCols).eq("session_id", value: sesion).order("created_date").execute().value
    }
    static func fotos(sesiones ids: [UUID]) async throws -> [Foto] {
        guard !ids.isEmpty else { return [] }
        return try await supabase.from("fotos").select(fotoCols).in("session_id", values: ids).execute().value
    }
    static func foto(_ id: UUID) async throws -> Foto {
        try await supabase.from("fotos").select(fotoCols).eq("id", value: id).single().execute().value
    }

    struct NuevaSesion: Encodable {
        let id: UUID
        let bloque_id: UUID
        let muestreador_name: String
        let started_at: String
        let status: String
        let photo_count: Double
        let fruit_count: Double
    }
    static func crearSesion(bloque: UUID, muestreador: String) async throws -> Sesion {
        let n = NuevaSesion(id: UUID(), bloque_id: bloque, muestreador_name: muestreador,
                            started_at: Fecha.now(), status: "borrador", photo_count: 0, fruit_count: 0)
        return try await supabase.from("sesiones").insert(n, returning: .representation).select().single().execute().value
    }

    struct CierreSesion: Encodable {
        let ended_at: String
        let status: String
        let photo_count: Double
        let fruit_count: Double
        let avg_diameter_mm: Double?
        let red_pct: Double
        let cracking_pct: Double
        let sunburn_pct: Double
        let russet_pct: Double
    }
    // Recalcula los totales desde lo que quedó guardado (el calibre lo pone Supabase).
    static func finalizar(sesion id: UUID) async throws {
        let fotos = try await fotos(sesion: id)
        let frutos = fotos.flatMap { $0.fruits ?? [] }
        let n = Double(frutos.count)
        func pct(_ f: (Fruta) -> Bool) -> Double { n > 0 ? Double(frutos.filter(f).count) / n * 100 : 0 }
        let diams = frutos.compactMap { $0.diameter_mm }
        let cierre = CierreSesion(
            ended_at: Fecha.now(), status: "listo",
            photo_count: Double(fotos.count), fruit_count: n,
            avg_diameter_mm: diams.isEmpty ? nil : diams.reduce(0, +) / Double(diams.count),
            red_pct: pct { $0.color_category == "rojo" || $0.color_category == "rojo_oscuro" },
            cracking_pct: pct { $0.tieneDefecto("cracking") },
            sunburn_pct: pct { $0.tieneDefecto("sunburn") },
            russet_pct: pct { $0.tieneDefecto("russet") })
        try await supabase.from("sesiones").update(cierre).eq("id", value: id).execute()
    }

    static func eliminarSesion(_ id: UUID) async throws {
        struct Res: Decodable { let storage_uris: [String]? }
        let res: Res = try await supabase.rpc("delete_sample", params: ["sample_id": id.uuidString]).execute().value
        if let paths = res.storage_uris, !paths.isEmpty {
            _ = try? await supabase.storage.from(Config.photosBucket).remove(paths: paths)
        }
    }

    // MARK: Imágenes
    static func imagen(_ path: String) async throws -> Data {
        try await supabase.storage.from(Config.photosBucket).download(path: path)
    }

    // MARK: Usuarios
    static func perfiles() async throws -> [Profile] {
        try await supabase.from("profiles").select("id,email,full_name,role").order("email").execute().value
    }
    static func cambiarRol(_ user: UUID, _ rol: Rol) async throws {
        try await supabase.rpc("set_user_role", params: ["target_user_id": user.uuidString, "new_role": rol.rawValue]).execute()
    }
}
