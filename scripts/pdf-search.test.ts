import assert from "node:assert/strict";
import {
  buildHaystack,
  findMatchesOnPage,
  findRanges,
  rectForItemSlice,
} from "../src/lib/pdf-search";

function testWordBoundaries() {
  assert.deepEqual(findRanges("the catalog has a cat", "cat"), [[18, 21]]);
  assert.deepEqual(findRanges("catalog", "cat"), []);
  assert.deepEqual(findRanges("cat", "cat"), [[0, 3]]);
  assert.deepEqual(findRanges("a cat.", "cat"), [[2, 5]]);
}

function testNoArtificialSpaces() {
  const items = [
    { str: "Real", transform: [1, 0, 0, 1, 0, 0], width: 40, height: 10 },
    { str: " ", transform: [1, 0, 0, 1, 40, 0], width: 4, height: 10 },
    { str: "Numbers", transform: [1, 0, 0, 1, 44, 0], width: 70, height: 10 },
  ];
  const { haystack } = buildHaystack(items);
  assert.equal(haystack, "real numbers");
}

function testTightHighlightInsideSentence() {
  const item = {
    str: "Introduction to real numbers today",
    transform: [1, 0, 0, 1, 100, 200],
    width: 340,
    height: 12,
  };
  // "real" starts at index 16
  const rect = rectForItemSlice(item, 16, 20);
  assert.ok(rect);
  assert.ok(rect!.x1 > 100);
  assert.ok(rect!.x2 < 100 + 340);
  assert.ok(rect!.x2 - rect!.x1 < 340 * 0.2);
}

function testFindMatchesUsesTightRects() {
  const items = [
    {
      str: "Introduction to real numbers today",
      transform: [1, 0, 0, 1, 0, 0],
      width: 340,
      height: 12,
    },
  ];
  const matches = findMatchesOnPage({
    items,
    query: "real",
    metaIndex: 0,
    pageInChapter: 1,
    globalPage: 1,
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].pdfRects.length, 1);
  const [rect] = matches[0].pdfRects;
  assert.ok(rect.x2 - rect.x1 < 80, "highlight should be much narrower than sentence");
}

function testNoFalsePositiveInsideWord() {
  const items = [
    {
      str: "The catalog lists chapters",
      transform: [1, 0, 0, 1, 0, 0],
      width: 200,
      height: 10,
    },
  ];
  const matches = findMatchesOnPage({
    items,
    query: "cat",
    metaIndex: 0,
    pageInChapter: 1,
    globalPage: 1,
  });
  assert.equal(matches.length, 0);
}

testWordBoundaries();
testNoArtificialSpaces();
testTightHighlightInsideSentence();
testFindMatchesUsesTightRects();
testNoFalsePositiveInsideWord();
console.log("pdf-search tests passed");
