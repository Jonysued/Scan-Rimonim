import SwiftUI

struct SesionDetalleView: View {
    let sesionId: UUID
    @EnvironmentObject var catalogo: Catalogo
    @EnvironmentObject var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var sesion: Sesion?
    @State private var fotos: [Foto] = []
    @State private var error: String?
    @State private var confirmarBorrado = false

    var frutas: [Fruta] { fotos.flatMap { $0.fruits ?? [] } }

    var body: some View {
        List {
            if let s = sesion {
                Section {
                    LabeledContent("Bloque", value: catalogo.nombreBloque(s.bloque_id))
                    LabeledContent("Fecha", value: Fecha.corta(s.started_at ?? s.created_date))
                    LabeledContent("Muestreador", value: s.muestreador_name ?? "-")
                }
                Section {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        Kpi(titulo: "Calibre medio", valor: fmt(s.avg_diameter_mm, " mm", dec: 1))
                        Kpi(titulo: "Frutos", valor: fmt(s.fruit_count))
                        Kpi(titulo: "% rojo", valor: fmt(s.red_pct, "%"))
                        Kpi(titulo: "Medidos con LiDAR", valor: "\(frutas.filter { $0.diameter_mm != nil }.count)/\(frutas.count)")
                    }.listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                }
                Section("Calibre") { HistogramaCalibre(frutas: frutas, clases: catalogo.clases(para: s.bloque_id)) }
                Section("Color") { HistogramaColor(frutas: frutas) }
                Section("Fotos") {
                    ForEach(fotos) { f in
                        VStack(alignment: .leading, spacing: 6) {
                            FotoAnotada(path: f.storage_uri, fruta: f.fruits?.first)
                            HStack {
                                EtiquetaCalibre(fruta: f.fruits?.first)
                                Spacer()
                                Text("\(nombreColor(f.fruits?.first?.color_category)) · \(fmt(f.fruits?.first?.color_score, "% rojo"))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if auth.esAdmin {
                    Section {
                        Button("Eliminar muestreo", role: .destructive) { confirmarBorrado = true }
                    }
                }
            } else if let error {
                Text(error).foregroundStyle(.red)
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Muestreo")
        .refreshable { await cargar() }
        .task { await cargar() }
        .confirmationDialog("¿Eliminar este muestreo y sus fotos?", isPresented: $confirmarBorrado, titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) {
                Task {
                    do { try await Repo.eliminarSesion(sesionId); dismiss() } catch { self.error = error.localizedDescription }
                }
            }
        }
    }

    func cargar() async {
        do {
            async let s = Repo.sesion(sesionId)
            async let f = Repo.fotos(sesion: sesionId)
            (sesion, fotos) = try await (s, f)
        } catch { self.error = error.localizedDescription }
    }
}

struct FilaSesion: View {
    let s: Sesion
    @EnvironmentObject var catalogo: Catalogo
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(catalogo.nombreBloque(s.bloque_id)).font(.subheadline.bold())
                Spacer()
                Text(fmt(s.avg_diameter_mm, " mm", dec: 1)).bold()
            }
            HStack {
                Text(Fecha.corta(s.started_at ?? s.created_date))
                Spacer()
                Text("\(fmt(s.fruit_count)) frutos · \(fmt(s.red_pct, "% rojo"))")
            }.font(.caption).foregroundStyle(.secondary)
        }
    }
}
