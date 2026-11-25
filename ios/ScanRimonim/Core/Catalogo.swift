import Foundation

// Fincas, bloques, variedades, clases y metas en memoria (son pocos registros).
@MainActor
final class Catalogo: ObservableObject {
    @Published var fincas: [Finca] = []
    @Published var bloques: [Bloque] = []
    @Published var variedades: [Variedad] = []
    @Published var clases: [ClaseComercial] = []
    @Published var metas: [MetaBloque] = []
    @Published var error: String?

    func cargar() async {
        do {
            async let f = Repo.fincas()
            async let b = Repo.bloques()
            async let v = Repo.variedades()
            async let c = Repo.clases()
            async let m = Repo.metas()
            (fincas, bloques, variedades, clases, metas) = try await (f, b, v, c, m)
            error = nil
        } catch {
            self.error = "No se pudieron cargar los datos: \(error.localizedDescription)"
        }
    }

    func bloque(_ id: UUID?) -> Bloque? { bloques.first { $0.id == id } }
    func finca(_ id: UUID?) -> Finca? { fincas.first { $0.id == id } }
    func variedad(_ id: UUID?) -> Variedad? { variedades.first { $0.id == id } }
    func meta(bloque id: UUID) -> MetaBloque? { metas.first { $0.bloque_id == id } }

    func nombreBloque(_ id: UUID?) -> String {
        guard let b = bloque(id) else { return "-" }
        let f = finca(b.finca_id)?.name
        return f.map { "\($0) · \(b.name)" } ?? b.name
    }

    // Clases comerciales que aplican a un bloque (por variedad, o generales)
    func clases(para bloqueId: UUID?) -> [ClaseComercial] {
        let v = bloque(bloqueId)?.variedad_id
        let propias = clases.filter { $0.variedad_id != nil && $0.variedad_id == v }
        return (propias.isEmpty ? clases.filter { $0.variedad_id == nil } : propias)
            .sorted { ($0.order ?? $0.min_mm) < ($1.order ?? $1.min_mm) }
    }
}
