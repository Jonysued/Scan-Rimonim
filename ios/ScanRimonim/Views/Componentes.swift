import SwiftUI
import Charts
import CoreLocation

// MARK: Foto desde Storage con contorno dibujado

@MainActor
final class CacheImagenes {
    static let shared = CacheImagenes()
    private var cache: [String: UIImage] = [:]
    func imagen(_ path: String) async -> UIImage? {
        if let i = cache[path] { return i }
        guard let d = try? await Repo.imagen(path), let i = UIImage(data: d) else { return nil }
        cache[path] = i
        return i
    }
}

struct FotoAnotada: View {
    let path: String?
    var local: UIImage? = nil
    let fruta: Fruta?
    @State private var img: UIImage?

    var body: some View {
        ZStack {
            if let i = local ?? img {
                Image(uiImage: i).resizable().scaledToFit()
                    .overlay {
                        GeometryReader { g in
                            if let c = fruta?.body_contour, c.count > 2 {
                                Path { p in
                                    let pts = c.map { CGPoint(x: $0.x / 1000 * g.size.width, y: $0.y / 1000 * g.size.height) }
                                    p.addLines(pts); p.closeSubpath()
                                }.stroke(Color.green, lineWidth: 2)
                            }
                        }
                    }
            } else {
                Rectangle().fill(Color.secondary.opacity(0.15)).aspectRatio(0.75, contentMode: .fit)
                    .overlay(ProgressView())
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .task(id: path) {
            if local == nil, let p = path { img = await CacheImagenes.shared.imagen(p) }
        }
    }
}

struct EtiquetaCalibre: View {
    let fruta: Fruta?
    var body: some View {
        if let d = fruta?.diameter_mm {
            Text("\(Int(d.rounded())) mm").bold()
        } else if let r = fruta?.lidar_silueta, r.status == "revisar" {
            Label("Revisar: \(motivo(r.reason))", systemImage: "exclamationmark.triangle")
                .foregroundStyle(.orange)
        } else if fruta == nil {
            Text("Sin fruta detectada").foregroundStyle(.orange)
        } else {
            Text("Sin medir").foregroundStyle(.secondary)
        }
    }
    func motivo(_ r: String?) -> String {
        switch r {
        case "forma_irregular": return "contorno raro"
        case "poca_confianza_lidar": return "poco LiDAR"
        case "distancia_fuera_de_rango": return "distancia"
        case "calibre_fuera_de_rango": return "calibre fuera de rango"
        default: return r ?? "-"
        }
    }
}

func nombreColor(_ c: String?) -> String {
    switch c {
    case "verde": return "Verde"
    case "rosado": return "Rosado"
    case "rojo": return "Rojo"
    case "rojo_oscuro": return "Rojo oscuro"
    default: return "-"
    }
}

// MARK: Tarjeta KPI

struct Kpi: View {
    let titulo: String
    let valor: String
    var alerta = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(titulo).font(.caption).foregroundStyle(.secondary)
            Text(valor).font(.title2.bold()).foregroundStyle(alerta ? .red : Tema.tinta)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }
}

func fmt(_ v: Double?, _ suf: String = "", dec: Int = 0) -> String {
    guard let v else { return "-" }
    return String(format: "%.\(dec)f", v) + suf
}

// MARK: Histogramas

struct HistogramaCalibre: View {
    let frutas: [Fruta]
    let clases: [ClaseComercial]

    struct Barra: Identifiable { let id = UUID(); let label: String; let n: Int }

    var barras: [Barra] {
        let d = frutas.compactMap(\.diameter_mm)
        if !clases.isEmpty {
            return clases.map { c in Barra(label: c.name, n: d.filter { $0 >= c.min_mm && $0 < c.max_mm }.count) }
        }
        let cortes: [(String, Double, Double)] = [("<60", 0, 60), ("60-70", 60, 70), ("70-80", 70, 80), ("80-90", 80, 90), ("90+", 90, 999)]
        return cortes.map { c in Barra(label: c.0, n: d.filter { $0 >= c.1 && $0 < c.2 }.count) }
    }

    var body: some View {
        if frutas.compactMap(\.diameter_mm).isEmpty {
            Text("Sin frutos medidos").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 80)
        } else {
            Chart(barras) { b in
                BarMark(x: .value("Calibre", b.label), y: .value("Frutos", b.n))
                    .foregroundStyle(Tema.granate)
                    .annotation(position: .top) { if b.n > 0 { Text("\(b.n)").font(.caption2) } }
            }.frame(height: 180)
        }
    }
}

struct HistogramaColor: View {
    let frutas: [Fruta]
    struct Barra: Identifiable { let id: Int; let n: Int; let pct: Int }
    var barras: [Barra] {
        let s = frutas.compactMap(\.color_score)
        return (1...6).map { lvl in
            let n = s.filter { nivelColor($0) == lvl }.count
            return Barra(id: lvl, n: n, pct: s.isEmpty ? 0 : Int((Double(n) / Double(s.count) * 100).rounded()))
        }
    }
    var body: some View {
        if frutas.compactMap(\.color_score).isEmpty {
            Text("Sin color medido").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 80)
        } else {
            Chart(barras) { b in
                BarMark(x: .value("Nivel", "\(b.id)"), y: .value("Frutos", b.n))
                    .foregroundStyle(Tema.colorNiveles[b.id - 1])
                    .annotation(position: .top) { if b.pct > 0 { Text("\(b.pct)%").font(.caption2) } }
            }
            .frame(height: 180)
            Text("Intensidad de color: 1 verde · 6 rojo completo").font(.caption2).foregroundStyle(.secondary)
        }
    }
}

// MARK: Ubicación

final class Ubicacion: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let m = CLLocationManager()
    @Published var ultima: CLLocation?
    func iniciar() {
        m.delegate = self
        m.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        m.requestWhenInUseAuthorization()
        m.startUpdatingLocation()
    }
    func detener() { m.stopUpdatingLocation() }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        ultima = locations.last
    }
}
