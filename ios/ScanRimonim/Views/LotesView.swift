import SwiftUI
import Charts

struct LotesView: View {
    @EnvironmentObject var catalogo: Catalogo
    @State private var sesiones: [Sesion] = []

    var body: some View {
        List {
            ForEach(catalogo.fincas) { finca in
                Section(finca.name) {
                    ForEach(catalogo.bloques.filter { $0.finca_id == finca.id }) { b in
                        NavigationLink(value: b) {
                            let ss = sesiones.filter { $0.bloque_id == b.id && $0.status == "listo" }
                            let ult = ss.max { ($0.fecha ?? .distantPast) < ($1.fecha ?? .distantPast) }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(b.name).font(.subheadline.bold())
                                Text("\(catalogo.variedad(b.variedad_id)?.name ?? "-") · \(ss.count) muestreos · último \(fmt(ult?.avg_diameter_mm, " mm", dec: 1))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Bloques")
        .navigationDestination(for: Bloque.self) { BloqueDetalleView(bloque: $0) }
        .refreshable { await cargar() }
        .task { await cargar() }
    }

    func cargar() async {
        await catalogo.cargar()
        sesiones = (try? await Repo.sesiones()) ?? []
    }
}

struct BloqueDetalleView: View {
    let bloque: Bloque
    @EnvironmentObject var catalogo: Catalogo
    @State private var sesiones: [Sesion] = []
    @State private var frutasUltima: [Fruta] = []

    var listas: [Sesion] {
        sesiones.filter { $0.bloque_id == bloque.id && $0.status == "listo" }
            .sorted { ($0.fecha ?? .distantPast) < ($1.fecha ?? .distantPast) }
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Finca", value: catalogo.finca(bloque.finca_id)?.name ?? "-")
                LabeledContent("Variedad", value: catalogo.variedad(bloque.variedad_id)?.name ?? "-")
                if let a = bloque.area_ha { LabeledContent("Superficie", value: fmt(a, " ha", dec: 1)) }
                if let m = catalogo.meta(bloque: bloque.id), let t = m.target_diameter_mm {
                    LabeledContent("Meta de calibre", value: fmt(t, " mm"))
                }
            }
            Section("Evolución del calibre") {
                let puntos = listas.filter { $0.avg_diameter_mm != nil && $0.fecha != nil }
                if puntos.isEmpty {
                    Text("Sin datos todavía").foregroundStyle(.secondary)
                } else {
                    Chart {
                        ForEach(puntos) { s in
                            LineMark(x: .value("Fecha", s.fecha!), y: .value("mm", s.avg_diameter_mm!))
                                .foregroundStyle(Tema.granate)
                            PointMark(x: .value("Fecha", s.fecha!), y: .value("mm", s.avg_diameter_mm!))
                                .foregroundStyle(Tema.granate)
                        }
                        if let t = catalogo.meta(bloque: bloque.id)?.target_diameter_mm {
                            RuleMark(y: .value("Meta", t)).foregroundStyle(.gray).lineStyle(StrokeStyle(dash: [4, 4]))
                        }
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 200)
                }
            }
            Section("Evolución del color (% rojo)") {
                let puntos = listas.filter { $0.red_pct != nil && $0.fecha != nil }
                if puntos.isEmpty {
                    Text("Sin datos todavía").foregroundStyle(.secondary)
                } else {
                    Chart(puntos) { s in
                        LineMark(x: .value("Fecha", s.fecha!), y: .value("% rojo", s.red_pct!)).foregroundStyle(.red)
                        PointMark(x: .value("Fecha", s.fecha!), y: .value("% rojo", s.red_pct!)).foregroundStyle(.red)
                    }
                    .chartYScale(domain: 0...100)
                    .frame(height: 180)
                }
            }
            if !frutasUltima.isEmpty {
                Section("Último muestreo: calibre") { HistogramaCalibre(frutas: frutasUltima, clases: catalogo.clases(para: bloque.id)) }
                Section("Último muestreo: color") { HistogramaColor(frutas: frutasUltima) }
            }
            Section("Muestreos") {
                ForEach(listas.reversed()) { s in
                    NavigationLink(value: s.id) { FilaSesion(s: s) }
                }
            }
        }
        .navigationTitle(bloque.name)
        .navigationDestination(for: UUID.self) { SesionDetalleView(sesionId: $0) }
        .task {
            sesiones = (try? await Repo.sesiones()) ?? []
            if let ult = listas.last {
                frutasUltima = ((try? await Repo.fotos(sesion: ult.id)) ?? []).flatMap { $0.fruits ?? [] }
            }
        }
    }
}

struct CompararView: View {
    @EnvironmentObject var catalogo: Catalogo
    @State private var sesiones: [Sesion] = []
    @State private var a: UUID?
    @State private var b: UUID?
    @State private var frutasA: [Fruta] = []
    @State private var frutasB: [Fruta] = []

    var listas: [Sesion] { sesiones.filter { $0.status == "listo" } }
    func s(_ id: UUID?) -> Sesion? { listas.first { $0.id == id } }

    var body: some View {
        List {
            Section("Elegí dos muestreos") {
                selector("A", $a)
                selector("B", $b)
            }
            if let sa = s(a), let sb = s(b) {
                Section("Comparación") {
                    Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                        GridRow { Text(""); Text("A").bold(); Text("B").bold(); Text("Dif.").bold() }
                        fila("Calibre", sa.avg_diameter_mm, sb.avg_diameter_mm, " mm", 1)
                        fila("% rojo", sa.red_pct, sb.red_pct, "%", 0)
                        fila("Frutos", sa.fruit_count, sb.fruit_count, "", 0)
                        fila("Cracking", sa.cracking_pct, sb.cracking_pct, "%", 0)
                        fila("Golpe de sol", sa.sunburn_pct, sb.sunburn_pct, "%", 0)
                        fila("Russet", sa.russet_pct, sb.russet_pct, "%", 0)
                    }.font(.subheadline)
                }
                Section("Calibre A") { HistogramaCalibre(frutas: frutasA, clases: catalogo.clases(para: sa.bloque_id)) }
                Section("Calibre B") { HistogramaCalibre(frutas: frutasB, clases: catalogo.clases(para: sb.bloque_id)) }
                Section("Color A") { HistogramaColor(frutas: frutasA) }
                Section("Color B") { HistogramaColor(frutas: frutasB) }
            }
        }
        .navigationTitle("Comparar")
        .task { sesiones = (try? await Repo.sesiones()) ?? [] }
        .onChange(of: a) { _, id in Task { frutasA = await frutas(id) } }
        .onChange(of: b) { _, id in Task { frutasB = await frutas(id) } }
    }

    func frutas(_ id: UUID?) async -> [Fruta] {
        guard let id else { return [] }
        return ((try? await Repo.fotos(sesion: id)) ?? []).flatMap { $0.fruits ?? [] }
    }

    func selector(_ t: String, _ sel: Binding<UUID?>) -> some View {
        Picker(t, selection: sel) {
            Text("Elegí").tag(UUID?.none)
            ForEach(listas) { s in
                Text("\(catalogo.nombreBloque(s.bloque_id)) · \(Fecha.corta(s.started_at ?? s.created_date))").tag(UUID?.some(s.id))
            }
        }
    }

    @ViewBuilder
    func fila(_ n: String, _ va: Double?, _ vb: Double?, _ suf: String, _ dec: Int) -> some View {
        GridRow {
            Text(n)
            Text(fmt(va, suf, dec: dec))
            Text(fmt(vb, suf, dec: dec))
            if let va, let vb { Text((vb - va >= 0 ? "+" : "") + fmt(vb - va, suf, dec: dec)) } else { Text("-") }
        }
    }
}
