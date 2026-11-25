import SwiftUI

@main
struct ScanRimonimApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var catalogo = Catalogo()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(catalogo)
                .tint(Tema.granate)
                .task { await auth.iniciar() }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var catalogo: Catalogo

    var body: some View {
        Group {
            if auth.cargando {
                ProgressView()
            } else if auth.userId == nil {
                LoginView()
            } else if auth.profile == nil || auth.rol == .pending {
                PendienteView()
            } else {
                MainTabs()
                    .task { await catalogo.cargar() }
            }
        }
    }
}

struct MainTabs: View {
    @EnvironmentObject var auth: AuthStore

    var body: some View {
        TabView {
            NavigationStack { DashboardView() }
                .tabItem { Label("Inicio", systemImage: "chart.bar.xaxis") }
            if auth.rol.puedeMuestrear {
                NavigationStack { NuevaSesionView() }
                    .tabItem { Label("Muestrear", systemImage: "camera.viewfinder") }
            }
            NavigationStack { LotesView() }
                .tabItem { Label("Bloques", systemImage: "square.grid.2x2") }
            NavigationStack { CompararView() }
                .tabItem { Label("Comparar", systemImage: "arrow.left.arrow.right") }
            if auth.esAdmin {
                NavigationStack { AdminView() }
                    .tabItem { Label("Admin", systemImage: "gearshape") }
            }
        }
    }
}

struct PendienteView: View {
    @EnvironmentObject var auth: AuthStore
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "hourglass").font(.largeTitle).foregroundStyle(Tema.granate)
            Text("Tu usuario está pendiente de aprobación").font(.headline)
            Text("Un administrador tiene que asignarte un rol para usar la app.")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button("Actualizar") { Task { await auth.cargarPerfil() } }.buttonStyle(.borderedProminent)
            Button("Cerrar sesión") { Task { await auth.salir() } }
            if let e = auth.error { Text(e).font(.footnote).foregroundStyle(.red) }
        }.padding(32)
    }
}

enum Tema {
    static let granate = Color(red: 0x7a / 255, green: 0x1f / 255, blue: 0x33 / 255)
    static let tinta = Color(red: 0x2a / 255, green: 0x1a / 255, blue: 0x1d / 255)
    static let suave = Color(red: 0x9b / 255, green: 0x7f / 255, blue: 0x82 / 255)
    static let colorNiveles: [Color] = [
        Color(red: 0x84/255, green: 0xcc/255, blue: 0x16/255),
        Color(red: 0xa3/255, green: 0xe6/255, blue: 0x35/255),
        Color(red: 0xfb/255, green: 0xbf/255, blue: 0x24/255),
        Color(red: 0xfb/255, green: 0x92/255, blue: 0x3c/255),
        Color(red: 0xef/255, green: 0x44/255, blue: 0x44/255),
        Color(red: 0xb9/255, green: 0x1c/255, blue: 0x1c/255),
    ]
}
