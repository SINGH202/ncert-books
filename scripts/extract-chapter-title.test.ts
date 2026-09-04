import assert from "node:assert/strict";
import {
  extractChapterTitleFromTextItems,
  joinNcertTitleTokens,
  looksLikeTruncatedChapterTitle,
  mergeWrappedTitleLines,
  toTitleCaseWords,
} from "./lib/extract-chapter-title";

function testJoinTokens() {
  assert.equal(
    joinNcertTitleTokens(["R", "EAL", " ", "N", "UMBERS"]),
    "REAL NUMBERS",
  );
  assert.equal(toTitleCaseWords("REAL NUMBERS"), "Real Numbers");
}

function testExtractFromJemhLayout() {
  const items = [
    { str: "R", x: 100, y: 622, height: 10 },
    { str: "EAL", x: 110, y: 622, height: 7 },
    { str: " ", x: 140, y: 622, height: 0 },
    { str: "N", x: 150, y: 622, height: 10 },
    { str: "UMBERS", x: 160, y: 622, height: 7 },
    { str: "R", x: 80, y: 481.7, height: 28 },
    { str: "EAL", x: 100, y: 481.7, height: 19.6 },
    { str: " ", x: 140, y: 481.7, height: 0 },
    { str: "N", x: 150, y: 481.7, height: 28 },
    { str: "UMBERS", x: 170, y: 481.7, height: 19.6 },
    { str: "1", x: 400, y: 481.2, height: 60 },
    { str: "1.1 Introduction", x: 80, y: 433.7, height: 12 },
  ];
  assert.equal(extractChapterTitleFromTextItems(items), "Real Numbers");
}

function testMergeWrappedContinuation() {
  assert.equal(looksLikeTruncatedChapterTitle("Continuity And"), true);
  assert.equal(looksLikeTruncatedChapterTitle("Inverse Trigonometric"), true);
  assert.equal(looksLikeTruncatedChapterTitle("Real Numbers"), false);

  const merged = mergeWrappedTitleLines([
    { text: "CONTINUITY AND", maxHeight: 28, avgY: 500 },
    { text: "DIFFERENTIABILITY", maxHeight: 26, avgY: 460 },
    { text: "1.1 Introduction", maxHeight: 12, avgY: 400 },
  ]);
  assert.equal(merged, "CONTINUITY AND DIFFERENTIABILITY");

  const inverse = extractChapterTitleFromTextItems([
    { str: "INVERSE", x: 80, y: 520, height: 28 },
    { str: " ", x: 160, y: 520, height: 0 },
    { str: "TRIGONOMETRIC", x: 170, y: 520, height: 24 },
    { str: "FUNCTIONS", x: 80, y: 480, height: 26 },
    { str: "2", x: 420, y: 510, height: 60 },
  ]);
  assert.equal(inverse, "Inverse Trigonometric Functions");
}

testJoinTokens();
testExtractFromJemhLayout();
testMergeWrappedContinuation();
console.log("extract-chapter-title tests passed");
