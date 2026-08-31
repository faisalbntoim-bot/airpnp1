import Foundation
import CoreLocation

protocol PropertyRepository {
    func list(filter: SearchFilter, page: Int, pageSize: Int) async throws -> [Property]
    func get(id: Property.ID) async throws -> Property?
    func nearby(centre: CLLocationCoordinate2D, radiusMeters: Double) async throws -> [Property]
    func create(_ property: Property) async throws -> Property
    func update(_ property: Property) async throws -> Property
    func delete(id: Property.ID) async throws
    func recordView(id: Property.ID) async throws
}

/// In-memory implementation seeded with MockData. Safe for previews & UI dev.
actor MockPropertyRepository: PropertyRepository {
    private var items: [Property]

    init(seed: [Property] = MockData.properties) {
        self.items = seed
    }

    func list(filter: SearchFilter, page: Int = 0, pageSize: Int = 20) async throws -> [Property] {
        try? await Task.sleep(nanoseconds: 120_000_000)  // simulate latency
        var result = items
        if !filter.categories.isEmpty {
            result = result.filter { filter.categories.contains($0.category) }
        }
        if !filter.purposes.isEmpty {
            result = result.filter { filter.purposes.contains($0.purpose) }
        }
        if let n = filter.neighborhood, !n.isEmpty {
            result = result.filter { $0.location.neighborhood.contains(n) }
        }
        if let min = filter.minPriceSAR { result = result.filter { $0.priceSAR >= min } }
        if let max = filter.maxPriceSAR { result = result.filter { $0.priceSAR <= max } }
        if let minA = filter.minArea    { result = result.filter { $0.areaSquareMeters >= minA } }
        if let maxA = filter.maxArea    { result = result.filter { $0.areaSquareMeters <= maxA } }
        if let r = filter.rooms         { result = result.filter { ($0.rooms ?? 0) >= r } }
        if let b = filter.bathrooms     { result = result.filter { ($0.bathrooms ?? 0) >= b } }
        if filter.furnishedOnly         { result = result.filter { $0.furnished == true } }
        if !filter.query.isEmpty {
            let q = filter.query.lowercased()
            result = result.filter {
                $0.title.lowercased().contains(q)
                    || $0.location.neighborhood.contains(filter.query)
                    || $0.location.city.contains(filter.query)
            }
        }
        switch filter.sort {
        case .newest:    result.sort { $0.createdAt > $1.createdAt }
        case .priceAsc:  result.sort { $0.priceSAR < $1.priceSAR }
        case .priceDesc: result.sort { $0.priceSAR > $1.priceSAR }
        case .areaDesc:  result.sort { $0.areaSquareMeters > $1.areaSquareMeters }
        case .relevance: break
        }
        let start = page * pageSize
        guard start < result.count else { return [] }
        return Array(result[start..<min(start + pageSize, result.count)])
    }

    func get(id: Property.ID) async throws -> Property? {
        items.first(where: { $0.id == id })
    }

    func nearby(centre: CLLocationCoordinate2D, radiusMeters: Double) async throws -> [Property] {
        items.filter { LocationService.distance(centre, $0.location.coordinate) <= radiusMeters }
    }

    func create(_ property: Property) async throws -> Property {
        items.append(property)
        return property
    }

    func update(_ property: Property) async throws -> Property {
        if let i = items.firstIndex(where: { $0.id == property.id }) {
            items[i] = property
            return property
        }
        throw APIError.notFound
    }

    func delete(id: Property.ID) async throws {
        items.removeAll { $0.id == id }
    }

    func recordView(id: Property.ID) async throws {
        if let i = items.firstIndex(where: { $0.id == id }) {
            items[i].viewsCount += 1
        }
    }
}
