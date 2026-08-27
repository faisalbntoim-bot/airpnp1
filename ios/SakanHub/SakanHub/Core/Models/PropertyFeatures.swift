import Foundation

/// A set of boolean/enum amenities a property may have.
/// Extend freely — the UI iterates over `PropertyFeatures.CodingKeys` to render chips.
struct PropertyFeatures: Codable, Hashable {
    var centralAC: Bool = false
    var privateParking: Bool = false
    var elevator: Bool = false
    var pool: Bool = false
    var garden: Bool = false
    var security24h: Bool = false
    var maidsRoom: Bool = false
    var driversRoom: Bool = false
    var kitchenAppliances: Bool = false
    var smartHome: Bool = false
    var seaView: Bool = false
    var closeToSchools: Bool = false
    var closeToMosque: Bool = false
    var closeToMall: Bool = false
    var wifi: Bool = false
    var backupPower: Bool = false
    var solarPanels: Bool = false
    var accessibility: Bool = false

    /// Ordered pairs used by the UI to render feature chips.
    var chips: [(label: String, systemImage: String, on: Bool)] {
        [
            ("مكيف مركزي",    "wind",              centralAC),
            ("موقف خاص",       "car.fill",          privateParking),
            ("مصعد",           "arrow.up.arrow.down",elevator),
            ("مسبح",           "figure.pool.swim",  pool),
            ("حديقة",          "leaf.fill",         garden),
            ("أمن ٢٤س",         "shield.fill",       security24h),
            ("غرفة خادمة",      "bed.double.fill",   maidsRoom),
            ("غرفة سائق",       "steeringwheel",     driversRoom),
            ("أجهزة مطبخ",      "oven.fill",         kitchenAppliances),
            ("منزل ذكي",       "wave.3.right",      smartHome),
            ("إطلالة بحرية",   "water.waves",       seaView),
            ("قرب المدارس",     "graduationcap.fill",closeToSchools),
            ("قرب المسجد",      "moon.stars.fill",   closeToMosque),
            ("قرب المولات",     "bag.fill",          closeToMall),
            ("واي فاي",         "wifi",              wifi),
            ("مولّد احتياطي",   "bolt.fill",         backupPower),
            ("طاقة شمسية",     "sun.max.fill",       solarPanels),
            ("متاح لذوي الاحتياجات", "figure.roll",   accessibility),
        ]
    }
}
