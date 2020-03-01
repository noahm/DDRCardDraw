import { useRoute, Link } from "wouter-preact";
import styles from "./header.css";

export function Header() {
  const [_, params] = useRoute<{ dataSet: string }>("/:dataSet/:anything*");
  if (!params) {
    return null;
  }
  return (
    <header className={styles.header}>
      <ul>
        <li>
          <Link href={`/${params.dataSet}`}>Browse</Link>
        </li>
        <li>
          <Link href={`/${params.dataSet}/draw`}>Draw Songs</Link>
        </li>
      </ul>
    </header>
  );
}
