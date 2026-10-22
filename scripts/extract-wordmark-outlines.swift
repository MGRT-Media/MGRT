// Extracts the outlines of the MGRT MEDIA wordmark's letters from Cormorant
// at weight 500, as JSON on standard output.
//
// Cormorant ships as a variable font, so "Medium" is not a file: it is the
// point 500 on the font's weight axis. This asks CoreText for that instance
// explicitly and checks that it was applied, rather than reading the file's
// default outlines (which are Light).
//
// Coordinates are in units of 1000 to the em, Y up, origin on the baseline.
//
//     swift scripts/extract-wordmark-outlines.swift asset-sources/studio/Cormorant.ttf \
//       > asset-sources/studio/wordmark-outlines.json
//
// macOS only (CoreText). The JSON it writes is committed, so rebuilding the
// model from it (`scripts/build-wall-lettering.mjs`) needs no Mac.
import CoreText
import Foundation

let weight: CGFloat = 500
let letters = "MGRTEDIA"
let unitsPerEm: CGFloat = 1000

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

guard CommandLine.arguments.count > 1 else { fail("usage: extract-wordmark-outlines.swift <font file>") }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
  let descriptor = descriptors.first
else { fail("could not read \(url.path)") }

let base = CTFontCreateWithFontDescriptor(descriptor, unitsPerEm, nil)
guard let axes = CTFontCopyVariationAxes(base) as? [[String: Any]] else { fail("not a variable font") }
// 'wght' as a four-character code.
let weightTag = 0x7767_6874
guard
  let axis = axes.first(where: { ($0[kCTFontVariationAxisIdentifierKey as String] as? Int) == weightTag }),
  let minimum = axis[kCTFontVariationAxisMinimumValueKey as String] as? CGFloat,
  let maximum = axis[kCTFontVariationAxisMaximumValueKey as String] as? CGFloat,
  let fallback = axis[kCTFontVariationAxisDefaultValueKey as String] as? CGFloat
else { fail("the font has no weight axis") }
guard weight >= minimum && weight <= maximum else { fail("weight \(weight) is outside the axis \(minimum)...\(maximum)") }

let instance = CTFontDescriptorCreateCopyWithVariation(descriptor, weightTag as CFNumber, weight)
let font = CTFontCreateWithFontDescriptor(instance, unitsPerEm, nil)
let applied = (CTFontCopyVariation(font) as? [Int: CGFloat])?[weightTag] ?? fallback
guard abs(applied - weight) < 0.5 else { fail("asked for weight \(weight), got \(applied)") }

func round2(_ value: CGFloat) -> Double { (Double(value) * 100).rounded() / 100 }

var glyphs: [String: Any] = [:]
for letter in letters {
  var characters = Array(String(letter).utf16)
  var glyph = CGGlyph(0)
  guard CTFontGetGlyphsForCharacters(font, &characters, &glyph, 1) else { fail("no glyph for \(letter)") }
  var advance = CGSize.zero
  CTFontGetAdvancesForGlyphs(font, .horizontal, &glyph, &advance, 1)
  guard let path = CTFontCreatePathForGlyph(font, glyph, nil) else { fail("no outline for \(letter)") }

  var contours: [[[Any]]] = []
  var current: [[Any]] = []
  path.applyWithBlock { pointer in
    let element = pointer.pointee
    let p = element.points
    switch element.type {
    case .moveToPoint:
      if !current.isEmpty { contours.append(current) }
      current = [["M", round2(p[0].x), round2(p[0].y)]]
    case .addLineToPoint:
      current.append(["L", round2(p[0].x), round2(p[0].y)])
    case .addQuadCurveToPoint:
      current.append(["Q", round2(p[0].x), round2(p[0].y), round2(p[1].x), round2(p[1].y)])
    case .addCurveToPoint:
      current.append(["C", round2(p[0].x), round2(p[0].y), round2(p[1].x), round2(p[1].y), round2(p[2].x), round2(p[2].y)])
    case .closeSubpath:
      if !current.isEmpty { contours.append(current) }
      current = []
    @unknown default:
      break
    }
  }
  if !current.isEmpty { contours.append(current) }
  glyphs[String(letter)] = ["advance": round2(advance.width), "contours": contours]
}

let output: [String: Any] = [
  "font": CTFontCopyFullName(font) as String,
  "source": url.lastPathComponent,
  "weight": Double(applied),
  "weightAxis": ["min": Double(minimum), "default": Double(fallback), "max": Double(maximum)],
  "unitsPerEm": Double(unitsPerEm),
  "ascent": round2(CTFontGetAscent(font)),
  "descent": round2(CTFontGetDescent(font)),
  "capHeight": round2(CTFontGetCapHeight(font)),
  "glyphs": glyphs,
]
let data = try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
