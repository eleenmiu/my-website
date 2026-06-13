import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

enum CutoutError: Error {
    case invalidArguments
    case imageLoadFailed(String)
    case maskFailed
    case renderFailed
    case writeFailed(String)
}

func loadCGImage(from url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, [
            kCGImageSourceShouldCache: true
          ] as CFDictionary) else {
        throw CutoutError.imageLoadFailed(url.path)
    }
    return image
}

func writePNG(_ image: CGImage, to url: URL) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw CutoutError.writeFailed(url.path)
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw CutoutError.writeFailed(url.path)
    }
}

guard CommandLine.arguments.count == 3 else {
    throw CutoutError.invalidArguments
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let cgImage = try loadCGImage(from: inputURL)

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

guard let observation = request.results?.first else {
    throw CutoutError.maskFailed
}

let source = CIImage(cgImage: cgImage)
let rawMask = CIImage(cvPixelBuffer: observation.pixelBuffer)
let scaledMask = rawMask.transformed(by: CGAffineTransform(
    scaleX: source.extent.width / rawMask.extent.width,
    y: source.extent.height / rawMask.extent.height
))

let transparent = CIImage(color: .clear).cropped(to: source.extent)
let blend = CIFilter.blendWithAlphaMask()
blend.inputImage = source
blend.backgroundImage = transparent
blend.maskImage = scaledMask

let context = CIContext(options: [.workingColorSpace: NSNull()])
guard let output = blend.outputImage,
      let rendered = context.createCGImage(output, from: source.extent) else {
    throw CutoutError.renderFailed
}

try FileManager.default.createDirectory(
    at: outputURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
try writePNG(rendered, to: outputURL)
