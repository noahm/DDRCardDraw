import { useDrawing } from "../drawing-context";
import { SongCardBase, type SongCardProps } from "./song-card";
import { getContentVariants } from "./variants";

export { SongCardProps };

export function SongCard(p: SongCardProps) {
  const cardType = useDrawing((d) => d.cardVariant);
  const cardImpl = getContentVariants(cardType);
  return <SongCardBase {...p} {...cardImpl} />;
}
