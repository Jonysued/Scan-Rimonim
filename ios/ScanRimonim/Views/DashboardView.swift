import SwiftUI

struct Alerta: Identifiable {
    let id = UUID()
    let bloque: String
    let texto: String
}

struct DashboardView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var catalogo: Catalogo
    @State private var sesiones: [Sesion] = []
    @State private var error: String?

    var listas: [Sesion] { sesiones.filter { $0.status == "listo" } }
    var ultimos7: [Sesion] {
        let corte = Date().addingTimeInterval(-7 * 86400)
        return listas.filter { ($0.fecha ?? .distantPast) >= corte }
    }

    var body: some View {
        List {
            Section {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    Kpi(titulo: "Muestreos (7 días)", valor: "\(ultimos7.count)")
                    Kpi(titulo: "Frutos (7 días)", valor: fmt(ultimos7.compactMap(\.fruit_count).reduce(0, +)))
                    Kpi(titulo: "Calibre medio", valor: fmt(promedio(ultimos7.compactMap(\.avg_diameter_mm)), " mm", dec: 1))
                    Kpi(titulo: "% rojo", valor: fmt(promedio(ultimos7.compactMap(\.red_pct)), "%"))
                }.listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
            }
            if !alertas.isEmpty {
                Section("Alertas") {
                    ForEach(alertas) { a in
                        Label {
                            VStack(alignment: .leading) {
                                Text(a.bloque).font(.subheadline.bold())
                                Text(a.texto).font(.caption)
                            }
                        } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange) }
                    }
                }
            }
            Section("Últimos muestreos") {
                if listas.isEmpty { Text("Todavía no hay muestreos").foregroundStyle(.secondary) }
                ForEach(listas.prefix(30)) { s in
                    NavigationLink(value: s.id) { FilaSesion(s: s) }
                }
            }
            if let e = error ?? catalogo.error { Section { Text(e).foregroundStyle(.red) } }
        }
        .navigationTitle("Hola, \(auth.profile?.full_name?.components(separatedBy: " ").first ?? "")")
        .navigationDestination(for: UUID.self) { SesionDetalleView(sesionId: $0) }
        .toolbar {
            Menu {
                Text(auth.profile?.email ?? "")
                Text("Rol: \(auth.rol.nombre)")
                Button("Cerrar sesión", role: .destructive) { Task { await auth.salir() } }
            } label: { Image(systemName: "person.circle") }
        }
        .refreshable { await cargar() }
        .task { await cargar() }
    }

    func cargar() async {
        do { sesiones = try await Repo.sesiones(); error = nil } catch { self.error = error.localizedDescription }
    }

    // Última sesión de cada bloque contra su meta
    var alertas: [Alerta] {
        var out: [Alerta] = []
        let porBloque = Dictionary(grouping: listas, by: \.bloque_id)
        for (bid, ss) in porBloque {
            guard let meta = catalogo.meta(bloque: bid),
                  let s = ss.max(by: { ($0.fecha ?? .distantPast) < ($1.fecha ?? .distantPast) }) else { continue }
            let nombre = catalogo.nombreBloque(bid)
            if let t = meta.target_diameter_mm, let d = s.avg_diameter_mm, d < t - 3 {
                out.append(Alerta(bloque: nombre, texto: String(format: "Calibre %.0f mm, meta %.0f mm", d, t)))
            }
            if let t = meta.target_red_pct, let r = s.red_pct, r < t {
                out.append(Alerta(bloque: nombre, texto: String(format: "Color %.0f%% rojo, meta %.0f%%", r, t)))
            }
            if let t = meta.max_cracking_pct, let v = s.cracking_pct, v > t {
                out.append(Alerta(bloque: nombre, texto: String(format: "Cracking %.0f%% (máx %.0f%%)", v, t)))
            }
            if let t = meta.max_sunburn_pct, let v = s.sunburn_pct, v > t {
                out.append(Alerta(bloque: nombre, texto: String(format: "Golpe de sol %.0f%% (máx %.0f%%)", v, t)))
            }
            if let t = meta.max_russet_pct, let v = s.russet_pct, v > t {
                out.append(Alerta(bloque: nombre, texto: String(format: "Russet %.0f%% (máx %.0f%%)", v, t)))
            }
        }
        return out
    }
}

func promedio(_ v: [Double]) -> Double? { v.isEmpty ? nil : v.reduce(0, +) / Double(v.count) }
