// swift-tools-version: 5.9
// This Package.swift lets you open the sources in Xcode 15+ directly
// (File ▸ Open ▸ pick `Package.swift`) without needing an .xcodeproj first.
// For App Store distribution you'll still create a real iOS App target
// (either an .xcodeproj or a Multiplatform App project) and add these files.

import PackageDescription

let package = Package(
    name: "SakanHub",
    defaultLocalization: "ar",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "SakanHub", targets: ["SakanHub"]),
    ],
    dependencies: [
        // Lottie animations. Safe wrapper degrades gracefully if the package is missing.
        .package(url: "https://github.com/airbnb/lottie-spm.git", from: "4.5.0"),
    ],
    targets: [
        .target(
            name: "SakanHub",
            dependencies: [
                .product(name: "Lottie", package: "lottie-spm"),
            ],
            path: "SakanHub",
            exclude: [
                "Info.plist",
                "Resources/Lottie/README.md",
            ],
            resources: [
                .process("Resources"),
            ]
        ),
    ]
)
