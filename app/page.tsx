import Link from "next/link";
import index from "@/content/a2z-index.json";
import { summarize, type IndexRow } from "@/lib/curriculum/summary";
import styles from "./page.module.css";

const summary = summarize(index as IndexRow[]);

export default function TitleScreen() {
  return (
    <main className={styles.screen}>
      <div className={styles.lanes} aria-hidden="true">
        <span />
        <span />
      </div>

      <header className={styles.hero}>
        <svg className={styles.emblem} viewBox="0 0 512 512" aria-hidden="true">
          <polygon
            points="256,56 429.2,156 429.2,356 256,456 82.8,356 82.8,156"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="28"
            strokeLinejoin="round"
          />
          <polyline
            points="210,170 130,256 210,342"
            fill="none"
            stroke="var(--magenta)"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="302,170 382,256 302,342"
            fill="none"
            stroke="var(--magenta)"
            strokeWidth="34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points="256,206 300,256 256,306 212,256" fill="var(--lime)" />
        </svg>
        <h1 className={styles.title}>
          Pattern <span>Clash</span>
        </h1>
        <p className={styles.tagline}>Read the lane. Name the pattern. Build the answer in C++.</p>
      </header>

      <dl className={styles.stats}>
        <div>
          <dt>Arenas</dt>
          <dd>{summary.arenas}</dd>
        </div>
        <div>
          <dt>Battles</dt>
          <dd>{summary.problems}</dd>
        </div>
        <div>
          <dt>Lessons</dt>
          <dd>{summary.lessons}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Link className={styles.play} href="/battle/pair-to-target" aria-describedby="soon">
          Battle
        </Link>
        <p id="soon" className={styles.soon}>
          Practice battle: Pair to Target. The full arenas open soon.
        </p>
      </div>
    </main>
  );
}
