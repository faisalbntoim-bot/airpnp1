import Foundation

/// Seeded demo data so previews and the app work without a backend.
enum MockData {
    static let demoUser = User(
        id: "mock_user_faisal",
        name: "فيصل الحربي",
        phone: "+966512345678",
        email: "faisal@example.com",
        role: .seeker,
        officeID: nil,
        avatarURL: nil,
        isVerified: true,
        createdAt: .now
    )

    static let ownerUserID: String = "mock_user_owner"

    static let offices: [Office] = [
        .init(
            id: "mock_office_riyadh",
            name: "مكتب الرياض العقاري",
            licenseNumber: "1200008845",
            ownerUserID: ownerUserID,
            agentIDs: [demoUser.id],
            subscription: .pro,
            propertiesCount: 12,
            rating: 4.8,
            isVerified: true
        )
    ]

    static let properties: [Property] = [
        make(
            title: "شقة ٣ غرف — حي الملقا",
            category: .apartment, purpose: .rent,
            price: 38_000, dailyRate: 260,
            area: 180, rooms: 3, baths: 2,
            hood: "حي الملقا", lat: 24.8020, lng: 46.6140
        ),
        make(
            title: "أرض سكنية — حي العارض",
            category: .land, purpose: .sale,
            price: 450_000, dailyRate: nil,
            area: 625, rooms: nil, baths: nil,
            hood: "حي العارض", lat: 24.8380, lng: 46.6120,
            polygon: [(24.8382,46.6118),(24.8382,46.6122),(24.8378,46.6122),(24.8378,46.6118)]
        ),
        make(
            title: "فيلا ٥ غرف — حي الملقا",
            category: .villa, purpose: .sale,
            price: 1_850_000, dailyRate: 650,
            area: 420, rooms: 5, baths: 4,
            hood: "حي الملقا", lat: 24.8060, lng: 46.6190
        ),
        make(
            title: "دوبلكس ٤ غرف — حي الياسمين",
            category: .duplex, purpose: .rent,
            price: 55_000, dailyRate: 390,
            area: 260, rooms: 4, baths: 3,
            hood: "حي الياسمين", lat: 24.8500, lng: 46.6570
        ),
        make(
            title: "استوديو مفروش — حي العارض",
            category: .studio, purpose: .daily,
            price: 16_000, dailyRate: 120,
            area: 85, rooms: 1, baths: 1,
            hood: "حي العارض", lat: 24.8330, lng: 46.6080
        ),
        make(
            title: "محل تجاري — حي القيروان",
            category: .shop, purpose: .rent,
            price: 74_000, dailyRate: nil,
            area: 90, rooms: nil, baths: 1,
            hood: "حي القيروان", lat: 24.8250, lng: 46.6020
        ),
        make(
            title: "مكتب في برج — حي الياسمين",
            category: .office, purpose: .rent,
            price: 96_000, dailyRate: nil,
            area: 140, rooms: nil, baths: 1,
            hood: "حي الياسمين", lat: 24.8520, lng: 46.6600
        ),
        make(
            title: "مزرعة استثمارية — طريق الثمامة",
            category: .farm, purpose: .sale,
            price: 2_650_000, dailyRate: nil,
            area: 5000, rooms: 4, baths: 3,
            hood: "طريق الثمامة", lat: 24.9000, lng: 46.8000
        ),
    ]

    static let notifications: [AppNotification] = [
        .init(id: UUID().uuidString, kind: .newMatch, title: "عقار جديد يطابق بحثك",
              body: "شقة ٣ غرف في حي النرجس ضمن ميزانيتك.",
              propertyID: properties.first?.id, isRead: false, createdAt: .now),
        .init(id: UUID().uuidString, kind: .priceChanged, title: "تغيّر سعر عقار محفوظ",
              body: "انخفض سعر «فيلا حي الملقا» بمقدار ٥٠٬٠٠٠ ر.س.",
              propertyID: properties[safe: 2]?.id, isRead: true,
              createdAt: .now.addingTimeInterval(-3600 * 24 * 2))
    ]

    // MARK: - Convenience factory

    private static func make(
        title: String,
        category: Property.Category, purpose: Property.Purpose,
        price: Double, dailyRate: Double?,
        area: Double, rooms: Int?, baths: Int?,
        hood: String, lat: Double, lng: Double,
        polygon: [(Double, Double)]? = nil
    ) -> Property {
        Property(
            id: UUID().uuidString,
            listingNumber: "P-\(Int.random(in: 1000...9999))",
            title: title,
            summary: "\(title) — سعر ضمن السوق، هوية وملكية موثّقة، جاهز للسكن.",
            category: category,
            purpose: purpose,
            status: .available,
            priceSAR: price,
            dailyRateSAR: dailyRate,
            monthlyRateSAR: dailyRate.map { $0 * 25 },
            pricePerMeterSAR: (price / max(area, 1)).rounded(),
            areaSquareMeters: area,
            rooms: rooms, bathrooms: baths, yearBuilt: 2022, furnished: category == .studio, floors: 1,
            location: PropertyLocation(
                latitude: lat, longitude: lng,
                city: "الرياض", neighborhood: hood, streetName: nil, district: nil, country: "SA",
                boundaryPolygon: polygon?.map { PropertyLocation.Coordinate(lat: $0.0, lng: $0.1) }
            ),
            features: PropertyFeatures(
                centralAC: true, privateParking: true, elevator: rooms.map { $0 > 2 } ?? true,
                pool: category == .villa, garden: category == .villa, security24h: true,
                maidsRoom: category == .villa, driversRoom: category == .villa,
                kitchenAppliances: category != .land, smartHome: false,
                closeToSchools: true, closeToMall: true, wifi: true
            ),
            media: [],
            model3D: nil,
            tour: nil,
            ownerID: ownerUserID,
            officeID: offices.first?.id,
            agentIDs: [demoUser.id],
            createdAt: .now, updatedAt: .now,
            viewsCount: Int.random(in: 200...9_000),
            featured: category == .villa,
            boostedUntil: nil
        )
    }
}

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
