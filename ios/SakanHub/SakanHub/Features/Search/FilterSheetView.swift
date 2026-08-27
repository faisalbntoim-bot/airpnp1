import SwiftUI

struct FilterSheetView: View {
    @Binding var filter: SearchFilter
    var onApply: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("النوع") {
                    ForEach(Property.Category.allCases, id: \.self) { c in
                        Toggle(c.rawValue, isOn: Binding(
                            get: { filter.categories.contains(c) },
                            set: { if $0 { filter.categories.insert(c) } else { filter.categories.remove(c) } }
                        ))
                    }
                }
                Section("الغرض") {
                    ForEach(Property.Purpose.allCases, id: \.self) { p in
                        Toggle(p.rawValue, isOn: Binding(
                            get: { filter.purposes.contains(p) },
                            set: { if $0 { filter.purposes.insert(p) } else { filter.purposes.remove(p) } }
                        ))
                    }
                }
                Section("السعر (ر.س)") {
                    OptionalDoubleField(title: "من", value: $filter.minPriceSAR)
                    OptionalDoubleField(title: "إلى", value: $filter.maxPriceSAR)
                }
                Section("المساحة (م²)") {
                    OptionalDoubleField(title: "من", value: $filter.minArea)
                    OptionalDoubleField(title: "إلى", value: $filter.maxArea)
                }
                Section("مواصفات") {
                    Stepper("عدد الغرف: \(filter.rooms ?? 0)",
                            value: Binding(get: { filter.rooms ?? 0 },
                                           set: { filter.rooms = ($0 == 0 ? nil : $0) }),
                            in: 0...10)
                    Stepper("دورات المياه: \(filter.bathrooms ?? 0)",
                            value: Binding(get: { filter.bathrooms ?? 0 },
                                           set: { filter.bathrooms = ($0 == 0 ? nil : $0) }),
                            in: 0...8)
                    Toggle("مفروش فقط", isOn: $filter.furnishedOnly)
                }
                Section("الترتيب") {
                    Picker("رتّب حسب", selection: $filter.sort) {
                        ForEach(SearchFilter.Sort.allCases, id: \.self) { s in Text(s.rawValue).tag(s) }
                    }
                }
            }
            .navigationTitle("الفلاتر")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("مسح") { filter = SearchFilter() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("تطبيق") { onApply(); dismiss() }
                        .bold()
                }
            }
        }
    }
}

private struct OptionalDoubleField: View {
    let title: String
    @Binding var value: Double?
    @State private var text: String = ""
    var body: some View {
        HStack {
            Text(title).foregroundStyle(Theme.textDim)
            TextField("—", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .onChange(of: text) { _, new in value = Double(new.trimmingCharacters(in: .whitespaces)) }
                .onAppear { text = value.map { String(Int($0)) } ?? "" }
        }
    }
}
