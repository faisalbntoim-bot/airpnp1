import SwiftUI
import SceneKit

/// 360° virtual tour built on top of SceneKit — no external panorama SDK required.
/// Loads equirectangular images as sphere textures and animates transitions between rooms.
struct VirtualTourView: View {
    let property: Property
    @Environment(\.dismiss) private var dismiss
    @State private var currentRoomID: UUID?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                if let tour = property.tour, !tour.rooms.isEmpty {
                    PanoramaViewer(room: currentRoom(in: tour))
                        .ignoresSafeArea()
                    roomBar(tour)
                } else {
                    EmptyStateView(icon: "vr.slash",
                                   title: "لا توجد جولة ٣٦٠ متاحة",
                                   subtitle: "سيتوفّر هذا العقار قريبًا بجولة افتراضية.")
                        .foregroundStyle(.white)
                        .padding()
                }
            }
            .background(Color.black)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark").foregroundStyle(.white) }
                }
            }
            .onAppear {
                currentRoomID = property.tour?.startRoomID ?? property.tour?.rooms.first?.id
            }
        }
    }

    private func currentRoom(in tour: VirtualTour) -> VirtualTour.Room {
        tour.rooms.first(where: { $0.id == currentRoomID }) ?? tour.rooms[0]
    }

    private func roomBar(_ tour: VirtualTour) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(tour.rooms) { room in
                    Chip(text: room.name, active: room.id == currentRoomID)
                        .onTapGesture { withAnimation { currentRoomID = room.id } }
                }
            }
            .padding(12)
        }
        .background(.ultraThinMaterial)
    }
}
