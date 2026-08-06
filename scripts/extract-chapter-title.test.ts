import assert from "node:assert/strict";
import {
  extractChapterTitleFromTextItems,
  joinNcertTitleTokens,
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

testJoinTokens();
testExtractFromJemhLayout();
console.log("extract-chapter-title tests passed");
