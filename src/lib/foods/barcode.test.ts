import { describe, expect, it } from "vitest";
import { barcodeVariants, gs1CheckDigit, isBarcode, isValidGtin, upcEToA } from "./barcode";

describe("barcodes", () => {
  it("validates GTIN check digits", () => {
    expect(isValidGtin("3017624010701")).toBe(true); // Nutella EAN-13
    expect(isValidGtin("3017624010702")).toBe(false);
    expect(isValidGtin("036000291452")).toBe(true); // UPC-A
    expect(gs1CheckDigit("03600029145")).toBe(2);
    expect(isBarcode("1234")).toBe(false);
  });
  it("expands UPC-E", () => {
    expect(upcEToA("04252614")).toBe("042100005264");
    expect(upcEToA("12345678")).not.toBeNull();
    expect(upcEToA("92345678")).toBeNull();
  });
  it("produces lookup variants", () => {
    expect(barcodeVariants("036000291452")).toEqual(["036000291452", "0036000291452"]);
    expect(barcodeVariants("0036000291452")).toEqual(["0036000291452", "036000291452"]);
    expect(barcodeVariants("00036000291452")).toEqual(["00036000291452", "0036000291452", "036000291452"]);
    expect(barcodeVariants("04252614")).toContain("042100005264");
    expect(barcodeVariants("abc")).toEqual([]);
  });
});
