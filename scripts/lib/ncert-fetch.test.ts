import assert from "node:assert/strict";
import {
  alternateNcertHost,
  fetchNcertResponse,
  fetchNcertText,
  ncertCurlArgs,
  ncertUpstreamCandidates,
} from "./ncert-fetch";

function connReset(): TypeError {
  const error = new TypeError("fetch failed");
  error.cause = Object.assign(new Error("read ECONNRESET"), {
    code: "ECONNRESET",
    errno: -104,
    syscall: "read",
  });
  return error;
}

function testAlternateHost() {
  assert.equal(
    alternateNcertHost("https://ncert.nic.in/textbook.php?ln=en"),
    "https://www.ncert.nic.in/textbook.php?ln=en",
  );
  assert.equal(
    alternateNcertHost("https://www.ncert.nic.in/textbook/pdf/jemh101.pdf"),
    "https://ncert.nic.in/textbook/pdf/jemh101.pdf",
  );
  assert.equal(alternateNcertHost("https://example.com/foo"), null);
}

function testUpstreamCandidates() {
  assert.deepEqual(
    ncertUpstreamCandidates("https://ncert.nic.in/textbook.php?ln=en"),
    [
      "https://ncert.nic.in/textbook.php?ln=en",
      "https://www.ncert.nic.in/textbook.php?ln=en",
    ],
  );
}

async function testSucceedsOnFirstHost() {
  const calls: string[] = [];
  const response = await fetchNcertResponse(
    "https://ncert.nic.in/textbook.php?ln=en",
    {
      sleep: async () => undefined,
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("<html>ok</html>", { status: 200 });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>ok</html>");
  assert.deepEqual(calls, ["https://ncert.nic.in/textbook.php?ln=en"]);
}

async function testFallsBackToWwwAfterConnReset() {
  const calls: string[] = [];
  const response = await fetchNcertResponse(
    "https://ncert.nic.in/textbook.php?ln=en",
    {
      sleep: async () => undefined,
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("://ncert.nic.in/")) throw connReset();
        return new Response("<html>www</html>", { status: 200 });
      },
    },
  );
  assert.equal(await response.text(), "<html>www</html>");
  assert.deepEqual(calls, [
    "https://ncert.nic.in/textbook.php?ln=en",
    "https://www.ncert.nic.in/textbook.php?ln=en",
  ]);
}

async function testRetriesThenSucceeds() {
  let attempts = 0;
  const response = await fetchNcertResponse(
    "https://ncert.nic.in/textbook.php?ln=en",
    {
      maxAttempts: 4,
      sleep: async () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) throw connReset();
        return new Response("ok", { status: 200 });
      },
    },
  );
  assert.equal(await response.text(), "ok");
  assert.equal(attempts, 3);
}

async function testRetriesRetryableHttpStatus() {
  let attempts = 0;
  const response = await fetchNcertResponse(
    "https://ncert.nic.in/textbook.php?ln=en",
    {
      maxAttempts: 3,
      sleep: async () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 2) return new Response("busy", { status: 503 });
        return new Response("ok", { status: 200 });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);
}

async function testDoesNotRetryNotFound() {
  let attempts = 0;
  const response = await fetchNcertResponse(
    "https://ncert.nic.in/textbook/pdf/missing.pdf",
    {
      sleep: async () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("missing", { status: 404 });
      },
    },
  );
  assert.equal(response.status, 404);
  assert.equal(attempts, 1);
}

async function testThrowsAfterAllAttemptsFail() {
  let attempts = 0;
  await assert.rejects(
    () =>
      fetchNcertResponse("https://ncert.nic.in/textbook.php?ln=en", {
        maxAttempts: 4,
        sleep: async () => undefined,
        fetchImpl: async () => {
          attempts += 1;
          throw connReset();
        },
      }),
    (error: unknown) => {
      assert.equal(error instanceof TypeError, true);
      assert.equal(attempts, 4);
      return true;
    },
  );
}

async function testSendsBrowserLikeHeaders() {
  let headers: Headers | undefined;
  await fetchNcertResponse("https://ncert.nic.in/textbook.php?ln=en", {
    sleep: async () => undefined,
    fetchImpl: async (_input, init) => {
      headers = new Headers(init?.headers);
      return new Response("ok", { status: 200 });
    },
  });
  assert.ok(headers);
  assert.match(headers.get("user-agent") ?? "", /Mozilla\/5\.0/i);
  assert.equal(headers.get("referer"), "https://ncert.nic.in/textbook.php");
}

function testCurlArgsUseHttp11AndRetries() {
  const args = ncertCurlArgs("https://ncert.nic.in/textbook.php?ln=en", 25_000);
  assert.equal(args.includes("--http1.1"), true);
  assert.equal(args.includes("--retry-all-errors"), true);
  assert.equal(args.includes("https://ncert.nic.in/textbook.php?ln=en"), true);
}

async function testTextUsesNodeFetchWhenItWorks() {
  let curlCalls = 0;
  const html = await fetchNcertText("https://ncert.nic.in/textbook.php?ln=en", {
    sleep: async () => undefined,
    fetchImpl: async () => new Response("<html>node</html>", { status: 200 }),
    curlImpl: async () => {
      curlCalls += 1;
      return "<html>curl</html>";
    },
  });
  assert.equal(html, "<html>node</html>");
  assert.equal(curlCalls, 0);
}

async function testTextFallsBackToCurlAfterNodeReset() {
  const html = await fetchNcertText("https://ncert.nic.in/textbook.php?ln=en", {
    maxAttempts: 2,
    sleep: async () => undefined,
    fetchImpl: async () => {
      throw connReset();
    },
    curlImpl: async (url) => `<html>curl:${url}</html>`,
  });
  assert.equal(
    html,
    "<html>curl:https://ncert.nic.in/textbook.php?ln=en</html>",
  );
}

async function testTextThrowsWhenNodeAndCurlFail() {
  await assert.rejects(
    () =>
      fetchNcertText("https://ncert.nic.in/textbook.php?ln=en", {
        maxAttempts: 2,
        sleep: async () => undefined,
        fetchImpl: async () => {
          throw connReset();
        },
        curlImpl: async () => {
          throw new Error("curl boom");
        },
      }),
    /curl boom/,
  );
}

async function main() {
  testAlternateHost();
  testUpstreamCandidates();
  await testSucceedsOnFirstHost();
  await testFallsBackToWwwAfterConnReset();
  await testRetriesThenSucceeds();
  await testRetriesRetryableHttpStatus();
  await testDoesNotRetryNotFound();
  await testThrowsAfterAllAttemptsFail();
  await testSendsBrowserLikeHeaders();
  testCurlArgsUseHttp11AndRetries();
  await testTextUsesNodeFetchWhenItWorks();
  await testTextFallsBackToCurlAfterNodeReset();
  await testTextThrowsWhenNodeAndCurlFail();
  console.log("ncert-fetch tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
