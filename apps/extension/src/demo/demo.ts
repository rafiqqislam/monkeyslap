import { runInteraction } from "../overlay";
import type { SlapPayload } from "../shared/messages";

/**
 * A fake endless feed for trying the slap. Works as an extension page and as a
 * plain web page (npm run dev, then open /src/demo/index.html), so the
 * animation can be tuned without loading the extension.
 */

const feed = document.getElementById("feed")!;
const captions = [
  "Just one more video, then bed.",
  "You won't believe what happens at 0:42.",
  "Top 10 things you'll forget in 5 minutes.",
  "My cat reviewing my code.",
  "POV: it's 2am and you're still here.",
  "This is the last post. Probably.",
];
let n = 0;

function addPosts(count: number) {
  for (let i = 0; i < count; i++, n++) {
    const hue = (n * 47) % 360;
    const post = document.createElement("article");
    post.className = "post";
    post.innerHTML = `
      <div class="who">
        <div class="avatar" style="background:hsl(${hue} 60% 60%)"></div>
        <span>user_${1000 + n}</span>
      </div>
      <div class="media" style="background:linear-gradient(135deg,hsl(${hue} 70% 75%),hsl(${(hue + 60) % 360} 70% 60%))"></div>
      <div class="caption"></div>`;
    post.querySelector(".caption")!.textContent = captions[n % captions.length]!;
    feed.append(post);
  }
}
addPosts(12);
new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) addPosts(6);
}).observe(
  feed.appendChild(Object.assign(document.createElement("div"), { style: "height:1px" })),
);

let slapCount = 0;
async function slap() {
  slapCount++;
  const intensity = Math.min(3, slapCount) as 1 | 2 | 3;
  const payload: SlapPayload = {
    decision: { interaction: "slap", intensity, slapNumber: slapCount },
    status: {
      domain: "endlessfeed.example",
      usedMs: 30 * 60_000 + slapCount * 3 * 60_000,
      limitMs: 30 * 60_000,
      dailyLimitMs: 30 * 60_000,
      remainingMs: 0,
      over: true,
      slapsToday: slapCount - 1,
      firstSlap: false,
    },
    characterId: "monkey",
    characterScale: 1,
    sound: true,
    reslapMinutes: 3,
  };
  await runInteraction(payload);
}

document.getElementById("slap")!.addEventListener("click", () => void slap());
if (new URLSearchParams(location.search).has("slap")) setTimeout(() => void slap(), 400);
