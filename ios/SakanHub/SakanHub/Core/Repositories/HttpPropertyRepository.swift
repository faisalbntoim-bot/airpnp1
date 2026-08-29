import Foundation
import CoreLocation

/// Real property listing / details / availability.
///
/// Conforms to the existing `PropertyRepository` protocol by projecting
/// API models into the legacy `Property` value type. Write operations
/// throw `.notImplemented` — the backend does not yet expose property
/// mutation endpoints for the app.
struct HttpPropertyRepository: PropertyRepository {
    let client: APIClient
    init(client: APIClient = .shared) { self.client = client }

    // MARK: - PropertyRepository conformance

    func list(filter: SearchFilter, page: Int = 0, pageSize: Int = 20) async throws -> [Property] {
        var q: [String: String] = ["page": String(max(page, 0) + 1), "pageSize": String(pageSize)]
        if !filter.query.isEmpty { q["search"] = filter.query }
        if let n = filter.neighborhood, !n.isEmpty { q["city"] = n }
        // Category / purpose filters — first-value only (backend takes a single).
        if let c = filter.categories.first {
            q["category"] = HttpPropertyRepository.categoryKey(c)
        }
        if let p = filter.purposes.first {
            q["purpose"] = HttpPropertyRepository.purposeKey(p)
        }
        let page: APIPagedProperties = try await client.get("/v1/properties", query: q, authed: false)
        return page.items.map(Self.toDomain(_:))
    }

    func get(id: Property.ID) async throws -> Property? {
        // Property.ID is now String (cuid). Direct lookup against the API.
        do {
            let api = try await apiProperty(id: id)
            return Self.toDomain(api)
        } catch APIError.notFound {
            return nil
        }
    }

    func nearby(centre: CLLocationCoordinate2D, radiusMeters: Double) async throws -> [Property] {
        // No geo endpoint yet — return the first page as a safe placeholder.
        _ = (centre, radiusMeters)
        let page: APIPagedProperties = try await client.get("/v1/properties", query: ["page": "1", "pageSize": "50"], authed: false)
        return page.items.map(Self.toDomain(_:))
    }

    func create(_ property: Property) async throws -> Property {
        throw APIError.notImplemented
    }
    func update(_ property: Property) async throws -> Property {
        throw APIError.notImplemented
    }
    func delete(id _: Property.ID) async throws {
        throw APIError.notImplemented
    }
    func recordView(id _: Property.ID) async throws {
        // No-op; backend doesn't track view counts yet.
    }

    // MARK: - Native API surface

    func apiList(page: Int = 1, pageSize: Int = 20) async throws -> APIPagedProperties {
        try await client.get("/v1/properties", query: ["page": String(page), "pageSize": String(pageSize)], authed: false)
    }

    func apiProperty(id: String) async throws -> APIProperty {
        try await client.get("/v1/properties/\(id)", authed: false)
    }

    func availability(propertyId: String, from: Date, to: Date) async throws -> APIAvailability {
        let iso = ISO8601DateFormatter()
        return try await client.get(
            "/v1/properties/\(propertyId)/availability",
            query: ["from": iso.string(from: from), "to": iso.string(from: to)],
            authed: false
        )
    }

    // MARK: - Projection helpers

    private static func categoryKey(_ c: Property.Category) -> String {
        switch c {
        case .apartment: return "apartment"
        case .villa: return "villa"
        case .duplex: return "duplex"
        case .studio: return "studio"
        case .land: return "land"
        case .office: return "office"
        case .shop: return "shop"
        case .farm: return "farm"
        case .commercial: return "commercial"
        case .building: return "building"
        }
    }

    private static func purposeKey(_ p: Property.Purpose) -> String {
        switch p {
        case .sale: return "sale"
        case .rent: return "rent"
        case .daily: return "daily"
        case .monthly: return "monthly"
        }
    }

    static func toDomain(_ p: APIProperty) -> Property {
        Property(
            id: p.id,                                              // cuid pass-through — no synthesis
            listingNumber: p.listingNumber,
            title: p.listingNumber,
            summary: "",
            category: Property.Category(mapping: p.category) ?? .apartment,
            purpose: Property.Purpose(mapping: p.purpose) ?? .rent,
            status: Property.Status(mapping: p.status) ?? .available,
            priceSAR: 0,
            dailyRateSAR: nil,
            monthlyRateSAR: nil,
            pricePerMeterSAR: nil,
            areaSquareMeters: 0,
            rooms: nil, bathrooms: nil, yearBuilt: nil, furnished: nil, floors: nil,
            location: PropertyLocation(latitude: 24.7136, longitude: 46.6753, city: "", neighborhood: "", streetName: nil, district: nil, country: "SA", boundaryPolygon: nil),
            features: PropertyFeatures(),
            media: [],
            model3D: nil, tour: nil,
            ownerID: p.ownerId ?? "",                              // empty when not exposed (public projection)
            officeID: p.officeId,
            agentIDs: [],
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            viewsCount: 0,
            featured: false,
            boostedUntil: nil
        )
    }
}

// MARK: - String-tolerant enum mappings

private extension Property.Category {
    init?(mapping raw: String) {
        switch raw.lowercased() {
        case "apartment":  self = .apartment
        case "villa":      self = .villa
        case "duplex":     self = .duplex
        case "studio":     self = .studio
        case "land":       self = .land
        case "office":     self = .office
        case "shop":       self = .shop
        case "farm":       self = .farm
        case "commercial": self = .commercial
        case "building":   self = .building
        default: return nil
        }
    }
}

private extension Property.Purpose {
    init?(mapping raw: String) {
        switch raw.lowercased() {
        case "sale":            self = .sale
        case "rent":            self = .rent
        case "daily":           self = .daily
        case "monthly":         self = .monthly
        case "commercial_rent": self = .rent
        default: return nil
        }
    }
}

private extension Property.Status {
    init?(mapping raw: String) {
        switch raw.lowercased() {
        case "available": self = .available
        case "reserved":  self = .reserved
        case "sold":      self = .sold
        case "rented":    self = .rented
        case "hidden":    self = .hidden
        default: return nil
        }
    }
}
