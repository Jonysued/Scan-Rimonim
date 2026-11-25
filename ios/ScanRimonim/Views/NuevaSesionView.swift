import SwiftUI

struct NuevaSesionView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var catalogo: Catalogo
    @StateObject private var ubicacion = Ubicacion()

    @State private var fincaId: UUID?
    @State private var bloqueId: UUID?
    @State private var sesion: Sesion?
    @State private var fotos: [Foto] = []
    @State private var locales: [UUID: UIImage] = [:]
    @State private var mostrandoCamara = false
    @State private var finalizando = false
    @State private var error: String?
    @State private var terminada: UUID?

    var bloquesFinca: [Bloque] { catalogo.bloques.filter { $0.finca_id == fincaId } }

    var body: some View {
        Form {
            Section("Lugar") {
                Picker("Finca", selection: $fincaId) {
                    Text("Elegí una finca").tag(UUID?.none)
                    ForEach(catalogo.fincas) { Text($0.name).tag(UUID?.some($0.id)) }
                }
                .disabled(sesion != nil)
                .onChange(of: fincaId) { _, _ in bloqueId = nil }
                Picker("Bloque", selection: $bloqueId) {
                    Text("Elegí un bloque").tag(UUID?.none)
                    ForEach(bloquesFinca) { Text($0.name).tag(UUID?.some($0.id)) }
                }
                .disabled(fincaId == nil || sesion != nil)
                LabeledContent("Muestreador", value: auth.nombre)
            }

            if bloqueId != nil {
                Section {
                    Button {
                        mostrandoCamara = true
                    } label: {
                        Label(fotos.isEmpty ? "Empezar a fotografiar" : "Sacar otra foto", systemImage: "camera.viewfinder")
                            .font(.headline)
                    }
                } footer: {
                    Text("Apuntá la retícula al centro de la granada, a unos 20 cm. La foto se toma sola cuando la distancia está estable.")
                }
            }

            if !fotos.isEmpty {
                Section("Fotos (\(fotos.count)) · calibre medio \(fmt(promedio, " mm", dec: 1))") {
                    ForEach(fotos) { f in
                        HStack(spacing: 12) {
                            FotoAnotada(path: f.storage_uri, local: locales[f.id], fruta: f.fruits?.first)
                                .frame(width: 70)
                            VStack(alignment: .leading, spacing: 4) {
                                EtiquetaCalibre(fruta: f.fruits?.first)
                                Text("Color: \(nombreColor(f.fruits?.first?.color_category)) · \(fmt(f.fruits?.first?.color_score, "% rojo"))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section {
                    Button {
                        Task { await finalizar() }
                    } label: {
                        HStack { Spacer(); if finalizando { ProgressView() }; Text("Finalizar muestreo").bold(); Spacer() }
                    }.disabled(finalizando)
                }
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
        }
        .navigationTitle("Nuevo muestreo")
        .fullScreenCover(isPresented: $mostrandoCamara) {
            CapturaView { captura in
                await guardar(captura)
            }
        }
        .navigationDestination(item: $terminada) { id in SesionDetalleView(sesionId: id) }
        .onAppear { ubicacion.iniciar() }
        .onDisappear { ubicacion.detener() }
    }

    var promedio: Double? {
        let d = fotos.compactMap { $0.fruits?.first?.diameter_mm }
        return d.isEmpty ? nil : d.reduce(0, +) / Double(d.count)
    }

    // Devuelve un mensaje para mostrar en la cámara
    func guardar(_ c: CapturaProcesada) async -> String {
        guard let uid = auth.userId, let bloqueId else { return "Falta el bloque" }
        do {
            if sesion == nil {
                sesion = try await Repo.crearSesion(bloque: bloqueId, muestreador: auth.profile?.email ?? auth.nombre)
            }
            let loc = ubicacion.ultima?.coordinate
            let f = try await Uploader.subir(c, sesion: sesion!.id, usuario: uid, lat: loc?.latitude, lng: loc?.longitude)
            locales[f.id] = c.imagen
            fotos.append(f)
            if let d = f.fruits?.first?.diameter_mm { return "\(Int(d.rounded())) mm · \(nombreColor(f.fruits?.first?.color_category))" }
            if c.fruta == nil { return "No se detectó la granada. Probá de nuevo." }
            return "Guardada, sin calibre (revisar)"
        } catch {
            return "Error al guardar: \(error.localizedDescription)"
        }
    }

    func finalizar() async {
        guard let s = sesion else { return }
        finalizando = true
        defer { finalizando = false }
        do {
            try await Repo.finalizar(sesion: s.id)
            terminada = s.id
            sesion = nil; fotos = []; locales = [:]
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: Cámara LiDAR con disparo automático

struct CapturaView: View {
    let onCaptura: (CapturaProcesada) async -> String
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cam = LidarCamera()
    @State private var procesando = false
    @State private var mensaje: String?
    @State private var bloqueoHasta = Date.distantPast
    @State private var auto = true

    var body: some View {
        ZStack {
            if cam.soportado {
                ARPreview(session: cam.session).ignoresSafeArea()
                Reticula(estado: estado)
            } else {
                Color.black.ignoresSafeArea()
                Text("Este iPhone no tiene LiDAR.\nUsá un iPhone Pro (12 Pro o posterior) o iPad Pro.")
                    .multilineTextAlignment(.center).foregroundStyle(.white).padding()
            }
            VStack {
                HStack {
                    Button("Listo") { dismiss() }.buttonStyle(.borderedProminent).tint(.black.opacity(0.6))
                    Spacer()
                    Toggle("Auto", isOn: $auto).toggleStyle(.button).tint(.black.opacity(0.6))
                }.padding()
                Spacer()
                VStack(spacing: 8) {
                    Text(textoDistancia).font(.title3.monospacedDigit().bold())
                    if let mensaje { Text(mensaje).font(.subheadline) }
                    if !auto {
                        Button { Task { await capturar() } } label: {
                            Circle().fill(.white).frame(width: 70, height: 70)
                                .overlay(Circle().stroke(Color.black.opacity(0.3), lineWidth: 3).padding(4))
                        }.disabled(!cam.enRango || procesando)
                    }
                }
                .foregroundStyle(.white)
                .padding()
                .background(RoundedRectangle(cornerRadius: 16).fill(.black.opacity(0.55)))
                .padding(.bottom, 30)
            }
            if procesando { ProgressView().scaleEffect(1.6).tint(.white) }
        }
        .onAppear { cam.iniciar() }
        .onDisappear { cam.pausar() }
        .onChange(of: cam.estable) { _, estable in
            if estable && auto && !procesando && Date() > bloqueoHasta { Task { await capturar() } }
        }
    }

    var estado: Reticula.Estado {
        if procesando { return .ocupado }
        if cam.estable { return .listo }
        if cam.enRango { return .casi }
        return .fuera
    }

    var textoDistancia: String {
        guard let d = cam.distanciaM else { return "Apuntá a la granada" }
        let cm = d * 100
        if cm < (Config.targetDistanceM - Config.toleranceM) * 100 { return String(format: "%.0f cm · alejate", cm) }
        if cm > (Config.targetDistanceM + Config.toleranceM) * 100 { return String(format: "%.0f cm · acercate", cm) }
        return String(format: "%.0f cm · %@", cm, cam.estable ? "quieto ✓" : "mantené quieto")
    }

    func capturar() async {
        guard let frame = cam.ultimoFrame, let d = cam.distanciaM else { return }
        procesando = true
        let span = cam.spanReciente(), dur = cam.duracionEstable()
        let resultado: Result<CapturaProcesada, Error> = await Task.detached(priority: .userInitiated) {
            Result { try CaptureProcessor.procesar(frame: frame, distancia: d, span: span, duracion: dur) }
        }.value
        switch resultado {
        case .success(let c):
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            mensaje = "Guardando…"
            mensaje = await onCaptura(c)
        case .failure(let e):
            mensaje = e.localizedDescription
        }
        procesando = false
        bloqueoHasta = Date().addingTimeInterval(2.5) // pausa para pasar a la siguiente granada
    }
}

struct Reticula: View {
    enum Estado { case fuera, casi, listo, ocupado }
    let estado: Estado
    var color: Color {
        switch estado {
        case .fuera: return .white
        case .casi: return .yellow
        case .listo: return .green
        case .ocupado: return .gray
        }
    }
    var body: some View {
        ZStack {
            Circle().stroke(color, lineWidth: 3).frame(width: 120, height: 120)
            Rectangle().fill(color).frame(width: 2, height: 24)
            Rectangle().fill(color).frame(width: 24, height: 2)
        }
    }
}
