import Foundation

// Las fechas se manejan como String ISO para no depender del decoder.
enum Fecha {
    private static let isoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    static func parse(_ s: String?) -> Date? {
        guard let s else { return nil }
        return isoFrac.date(from: s) ?? iso.date(from: s)
    }
    static func now() -> String { isoFrac.string(from: Date()) }
    static func corta(_ s: String?) -> String {
        guard let d = parse(s) else { return "-" }
        return d.formatted(date: .abbreviated, time: .shortened)
    }
}

enum Rol: String, Codable {
    case pending, lector, muestreador, admin
    var nombre: String {
        switch self {
        case .pending: return "Pendiente"
        case .lector: return "Lector"
        case .muestreador: return "Muestreador"
        case .admin: return "Administrador"
        }
    }
    var puedeMuestrear: Bool { self == .admin || self == .muestreador }
}

struct Profile: Codable, Identifiable, Hashable {
    let id: UUID
    var email: String
    var full_name: String?
    var role: Rol
}

struct Finca: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
    var region: String?
    var lat: Double?
    var lng: Double?
}

struct Variedad: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
}

struct Bloque: Codable, Identifiable, Hashable {
    var id: UUID
    var finca_id: UUID
    var name: String
    var variedad_id: UUID?
    var area_ha: Double?
    var tree_count: Double?
    var plant_year: Double?
}

struct ClaseComercial: Codable, Identifiable, Hashable {
    var id: UUID
    var variedad_id: UUID?
    var name: String
    var min_mm: Double
    var max_mm: Double
    var order: Double?
}

struct MetaBloque: Codable, Identifiable, Hashable {
    var id: UUID
    var bloque_id: UUID
    var season: String?
    var target_date: String?
    var target_diameter_mm: Double?
    var target_red_pct: Double?
    var max_cracking_pct: Double?
    var max_sunburn_pct: Double?
    var max_russet_pct: Double?
}

struct Sesion: Codable, Identifiable, Hashable {
    var id: UUID
    var created_date: String?
    var created_by: UUID?
    var bloque_id: UUID
    var muestreador_name: String?
    var started_at: String?
    var ended_at: String?
    var status: String?
    var photo_count: Double?
    var fruit_count: Double?
    var avg_diameter_mm: Double?
    var red_pct: Double?
    var cracking_pct: Double?
    var sunburn_pct: Double?
    var russet_pct: Double?

    var fecha: Date? { Fecha.parse(started_at ?? created_date) }
}

struct Punto: Codable, Hashable {
    var x: Double
    var y: Double
}

struct Defecto: Codable, Hashable {
    var type: String?
    var severity: String?
    var confidence: Double?
}

struct LidarSilueta: Codable, Hashable {
    var status: String?
    var reason: String?
    var method: String?
    var diameter_mm: Double?
    var z_front_mm: Double?
}

struct Fruta: Codable, Hashable {
    var body_contour: [Punto]?
    var segmentation_seed: Punto?
    var segmentation_model: String?
    var localization_status: String?
    var localization_confidence: Double?
    var localization_version: Int?
    var color_score: Double?
    var color_category: String?
    var red_coverage_pct: Double?
    var color_analysis_version: Int?
    var diameter_mm: Double?
    var diameter_source: String?
    var measurement_status: String?
    var lidar_silueta: LidarSilueta?
    var defects: [Defecto]?

    func tieneDefecto(_ tipo: String) -> Bool {
        (defects ?? []).contains { $0.type == tipo }
    }
}

struct Foto: Codable, Identifiable, Hashable {
    var id: UUID
    var created_date: String?
    var created_by: UUID?
    var session_id: UUID
    var captured_at: String?
    var storage_uri: String?
    var lat: Double?
    var lng: Double?
    var status: String?
    var fruit_count_estimate: Double?
    var avg_diameter_mm: Double?
    var fruits: [Fruta]?
    var measurement_status: String?
}

// Escala de color 1-6 (igual al histograma web)
func nivelColor(_ score: Double) -> Int {
    min(6, max(1, 1 + Int(floor(score / 100 * 6))))
}
