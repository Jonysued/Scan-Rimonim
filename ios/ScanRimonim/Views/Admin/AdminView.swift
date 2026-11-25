import SwiftUI
import Supabase

struct AdminView: View {
    var body: some View {
        List {
            NavigationLink("Fincas") { AdminFincas() }
            NavigationLink("Bloques") { AdminBloques() }
            NavigationLink("Variedades") { AdminVariedades() }
            NavigationLink("Clases comerciales (calibres)") { AdminClases() }
            NavigationLink("Metas por bloque") { AdminMetas() }
            NavigationLink("Usuarios y roles") { AdminUsuarios() }
        }
        .navigationTitle("Administración")
    }
}

// Utilidades de escritura genéricas
enum AdminRepo {
    static func guardar<T: Encodable>(_ tabla: String, id: UUID?, _ valor: T) async throws {
        if let id {
            try await supabase.from(tabla).update(valor).eq("id", value: id).execute()
        } else {
            try await supabase.from(tabla).insert(valor).execute()
        }
    }
    static func borrar(_ tabla: String, _ id: UUID) async throws {
        try await supabase.from(tabla).delete().eq("id", value: id).execute()
    }
}

func numero(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }
func texto(_ d: Double?) -> String { d.map { $0 == $0.rounded() ? String(Int($0)) : String($0) } ?? "" }

struct ErrorAdmin: View {
    let e: String?
    var body: some View { if let e { Text(e).foregroundStyle(.red).font(.footnote) } }
}

// MARK: Fincas

struct AdminFincas: View {
    @EnvironmentObject var c: Catalogo
    @State private var editando: Finca?
    @State private var nueva = false
    @State private var error: String?
    var body: some View {
        List {
            ForEach(c.fincas) { f in
                Button { editando = f } label: { VStack(alignment: .leading) { Text(f.name); Text(f.region ?? "").font(.caption).foregroundStyle(.secondary) } }
            }
            .onDelete { idx in
                Task {
                    for i in idx { do { try await AdminRepo.borrar("fincas", c.fincas[i].id) } catch { self.error = "No se puede borrar: tiene bloques asociados." } }
                    await c.cargar()
                }
            }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Fincas")
        .toolbar { Button { nueva = true } label: { Image(systemName: "plus") } }
        .sheet(item: $editando) { FincaForm(finca: $0) }
        .sheet(isPresented: $nueva) { FincaForm(finca: nil) }
    }
}

struct FincaForm: View {
    let finca: Finca?
    @EnvironmentObject var c: Catalogo
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var region = ""
    @State private var error: String?
    struct Fila: Encodable { let name: String; let region: String? }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Nombre", text: $name)
                TextField("Región", text: $region)
                ErrorAdmin(e: error)
            }
            .navigationTitle(finca == nil ? "Nueva finca" : "Editar finca")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        Task {
                            do {
                                try await AdminRepo.guardar("fincas", id: finca?.id, Fila(name: name, region: region.isEmpty ? nil : region))
                                await c.cargar(); dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }.disabled(name.isEmpty)
                }
            }
            .onAppear { name = finca?.name ?? ""; region = finca?.region ?? "" }
        }
    }
}

// MARK: Variedades

struct AdminVariedades: View {
    @EnvironmentObject var c: Catalogo
    @State private var nombre = ""
    @State private var error: String?
    struct Fila: Encodable { let name: String }
    var body: some View {
        List {
            Section {
                HStack {
                    TextField("Nueva variedad", text: $nombre)
                    Button("Agregar") {
                        Task {
                            do { try await AdminRepo.guardar("variedades", id: nil, Fila(name: nombre)); nombre = ""; await c.cargar() }
                            catch { self.error = error.localizedDescription }
                        }
                    }.disabled(nombre.isEmpty)
                }
            }
            ForEach(c.variedades) { Text($0.name) }
                .onDelete { idx in
                    Task {
                        for i in idx { do { try await AdminRepo.borrar("variedades", c.variedades[i].id) } catch { self.error = "No se puede borrar: está en uso." } }
                        await c.cargar()
                    }
                }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Variedades")
    }
}

// MARK: Bloques

struct AdminBloques: View {
    @EnvironmentObject var c: Catalogo
    @State private var editando: Bloque?
    @State private var nuevo = false
    @State private var error: String?
    var body: some View {
        List {
            ForEach(c.bloques) { b in
                Button { editando = b } label: {
                    VStack(alignment: .leading) {
                        Text(b.name)
                        Text("\(c.finca(b.finca_id)?.name ?? "-") · \(c.variedad(b.variedad_id)?.name ?? "-")").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .onDelete { idx in
                Task {
                    for i in idx { do { try await AdminRepo.borrar("bloques", c.bloques[i].id) } catch { self.error = "No se puede borrar: tiene muestreos o metas." } }
                    await c.cargar()
                }
            }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Bloques")
        .toolbar { Button { nuevo = true } label: { Image(systemName: "plus") } }
        .sheet(item: $editando) { BloqueForm(bloque: $0) }
        .sheet(isPresented: $nuevo) { BloqueForm(bloque: nil) }
    }
}

struct BloqueForm: View {
    let bloque: Bloque?
    @EnvironmentObject var c: Catalogo
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var finca: UUID?
    @State private var variedad: UUID?
    @State private var area = ""
    @State private var arboles = ""
    @State private var anio = ""
    @State private var error: String?
    struct Fila: Encodable {
        let name: String; let finca_id: UUID; let variedad_id: UUID?
        let area_ha: Double?; let tree_count: Double?; let plant_year: Double?
    }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Nombre", text: $name)
                Picker("Finca", selection: $finca) {
                    Text("Elegí").tag(UUID?.none)
                    ForEach(c.fincas) { Text($0.name).tag(UUID?.some($0.id)) }
                }
                Picker("Variedad", selection: $variedad) {
                    Text("Sin variedad").tag(UUID?.none)
                    ForEach(c.variedades) { Text($0.name).tag(UUID?.some($0.id)) }
                }
                TextField("Superficie (ha)", text: $area).keyboardType(.decimalPad)
                TextField("Cantidad de árboles", text: $arboles).keyboardType(.numberPad)
                TextField("Año de plantación", text: $anio).keyboardType(.numberPad)
                ErrorAdmin(e: error)
            }
            .navigationTitle(bloque == nil ? "Nuevo bloque" : "Editar bloque")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        guard let finca else { return }
                        Task {
                            do {
                                try await AdminRepo.guardar("bloques", id: bloque?.id,
                                    Fila(name: name, finca_id: finca, variedad_id: variedad,
                                         area_ha: numero(area), tree_count: numero(arboles), plant_year: numero(anio)))
                                await c.cargar(); dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }.disabled(name.isEmpty || finca == nil)
                }
            }
            .onAppear {
                name = bloque?.name ?? ""; finca = bloque?.finca_id; variedad = bloque?.variedad_id
                area = texto(bloque?.area_ha); arboles = texto(bloque?.tree_count); anio = texto(bloque?.plant_year)
            }
        }
    }
}

// MARK: Clases comerciales

struct AdminClases: View {
    @EnvironmentObject var c: Catalogo
    @State private var editando: ClaseComercial?
    @State private var nueva = false
    @State private var error: String?
    var body: some View {
        List {
            Section {
                ForEach(c.clases) { k in
                    Button { editando = k } label: {
                        HStack {
                            Text(k.name)
                            Spacer()
                            Text("\(texto(k.min_mm))–\(texto(k.max_mm)) mm").foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { idx in
                    Task {
                        for i in idx { do { try await AdminRepo.borrar("clases_comerciales", c.clases[i].id) } catch { self.error = error.localizedDescription } }
                        await c.cargar()
                    }
                }
            } footer: { Text("Rangos de calibre que usan los histogramas. Mínimo incluido, máximo excluido.") }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Clases comerciales")
        .toolbar { Button { nueva = true } label: { Image(systemName: "plus") } }
        .sheet(item: $editando) { ClaseForm(clase: $0) }
        .sheet(isPresented: $nueva) { ClaseForm(clase: nil) }
    }
}

struct ClaseForm: View {
    let clase: ClaseComercial?
    @EnvironmentObject var c: Catalogo
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var minmm = ""
    @State private var maxmm = ""
    @State private var orden = ""
    @State private var variedad: UUID?
    @State private var error: String?
    struct Fila: Encodable { let name: String; let min_mm: Double; let max_mm: Double; let order: Double?; let variedad_id: UUID? }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Nombre (ej: Calibre 1)", text: $name)
                TextField("Mínimo (mm)", text: $minmm).keyboardType(.decimalPad)
                TextField("Máximo (mm)", text: $maxmm).keyboardType(.decimalPad)
                TextField("Orden", text: $orden).keyboardType(.numberPad)
                Picker("Variedad", selection: $variedad) {
                    Text("Todas").tag(UUID?.none)
                    ForEach(c.variedades) { Text($0.name).tag(UUID?.some($0.id)) }
                }
                ErrorAdmin(e: error)
            }
            .navigationTitle(clase == nil ? "Nueva clase" : "Editar clase")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        guard let mi = numero(minmm), let ma = numero(maxmm) else { return }
                        Task {
                            do {
                                try await AdminRepo.guardar("clases_comerciales", id: clase?.id,
                                    Fila(name: name, min_mm: mi, max_mm: ma, order: numero(orden), variedad_id: variedad))
                                await c.cargar(); dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }.disabled(name.isEmpty || numero(minmm) == nil || numero(maxmm) == nil)
                }
            }
            .onAppear {
                name = clase?.name ?? ""; minmm = texto(clase?.min_mm); maxmm = texto(clase?.max_mm)
                orden = texto(clase?.order); variedad = clase?.variedad_id
            }
        }
    }
}

// MARK: Metas

struct AdminMetas: View {
    @EnvironmentObject var c: Catalogo
    @State private var editando: MetaBloque?
    @State private var nueva = false
    @State private var error: String?
    var body: some View {
        List {
            ForEach(c.metas) { m in
                Button { editando = m } label: {
                    VStack(alignment: .leading) {
                        Text(c.nombreBloque(m.bloque_id))
                        Text("Calibre \(fmt(m.target_diameter_mm, " mm")) · rojo \(fmt(m.target_red_pct, "%")) · cracking máx \(fmt(m.max_cracking_pct, "%"))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .onDelete { idx in
                Task {
                    for i in idx { do { try await AdminRepo.borrar("metas_bloque", c.metas[i].id) } catch { self.error = error.localizedDescription } }
                    await c.cargar()
                }
            }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Metas")
        .toolbar { Button { nueva = true } label: { Image(systemName: "plus") } }
        .sheet(item: $editando) { MetaForm(meta: $0) }
        .sheet(isPresented: $nueva) { MetaForm(meta: nil) }
    }
}

struct MetaForm: View {
    let meta: MetaBloque?
    @EnvironmentObject var c: Catalogo
    @Environment(\.dismiss) var dismiss
    @State private var bloque: UUID?
    @State private var season = ""
    @State private var diam = ""
    @State private var rojo = ""
    @State private var crack = ""
    @State private var sol = ""
    @State private var russet = ""
    @State private var error: String?
    struct Fila: Encodable {
        let bloque_id: UUID; let season: String?
        let target_diameter_mm: Double?; let target_red_pct: Double?
        let max_cracking_pct: Double?; let max_sunburn_pct: Double?; let max_russet_pct: Double?
    }
    var body: some View {
        NavigationStack {
            Form {
                Picker("Bloque", selection: $bloque) {
                    Text("Elegí").tag(UUID?.none)
                    ForEach(c.bloques) { b in Text(c.nombreBloque(b.id)).tag(UUID?.some(b.id)) }
                }
                TextField("Temporada (ej: 2026/27)", text: $season)
                Section("Metas") {
                    TextField("Calibre objetivo (mm)", text: $diam).keyboardType(.decimalPad)
                    TextField("% rojo objetivo", text: $rojo).keyboardType(.decimalPad)
                }
                Section("Máximos tolerados") {
                    TextField("Cracking máx (%)", text: $crack).keyboardType(.decimalPad)
                    TextField("Golpe de sol máx (%)", text: $sol).keyboardType(.decimalPad)
                    TextField("Russet máx (%)", text: $russet).keyboardType(.decimalPad)
                }
                ErrorAdmin(e: error)
            }
            .navigationTitle(meta == nil ? "Nueva meta" : "Editar meta")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        guard let bloque else { return }
                        Task {
                            do {
                                try await AdminRepo.guardar("metas_bloque", id: meta?.id,
                                    Fila(bloque_id: bloque, season: season.isEmpty ? nil : season,
                                         target_diameter_mm: numero(diam), target_red_pct: numero(rojo),
                                         max_cracking_pct: numero(crack), max_sunburn_pct: numero(sol), max_russet_pct: numero(russet)))
                                await c.cargar(); dismiss()
                            } catch { self.error = error.localizedDescription }
                        }
                    }.disabled(bloque == nil)
                }
            }
            .onAppear {
                bloque = meta?.bloque_id; season = meta?.season ?? ""
                diam = texto(meta?.target_diameter_mm); rojo = texto(meta?.target_red_pct)
                crack = texto(meta?.max_cracking_pct); sol = texto(meta?.max_sunburn_pct); russet = texto(meta?.max_russet_pct)
            }
        }
    }
}

// MARK: Usuarios

struct AdminUsuarios: View {
    @EnvironmentObject var auth: AuthStore
    @State private var perfiles: [Profile] = []
    @State private var error: String?
    var body: some View {
        List {
            ForEach(perfiles) { p in
                HStack {
                    VStack(alignment: .leading) {
                        Text(p.full_name ?? p.email)
                        Text(p.email).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Menu(p.role.nombre) {
                        ForEach([Rol.pending, .lector, .muestreador, .admin], id: \.self) { r in
                            Button(r.nombre) {
                                Task {
                                    do { try await Repo.cambiarRol(p.id, r); await cargar() }
                                    catch { self.error = error.localizedDescription }
                                }
                            }
                        }
                    }
                    .disabled(p.id == auth.userId)
                }
            }
            ErrorAdmin(e: error)
        }
        .navigationTitle("Usuarios")
        .refreshable { await cargar() }
        .task { await cargar() }
    }
    func cargar() async {
        do { perfiles = try await Repo.perfiles() } catch { self.error = error.localizedDescription }
    }
}
