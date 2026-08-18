import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PlayingCard } from './PlayingCard.jsx';
import { cn } from '../../lib/cn.js';

const bottomTuck = 46;
const hoverLift = 54;
const pileLift = -224;
const minFanSpacing = 26;

const rankNames = {
  A: 'ace',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function fanTransform(index, count, spacing) {
  const offset = index - (count - 1) / 2;
  const stepDeg = count > 1 ? Math.min(9, 46 / (count - 1)) : 0;
  const rotate = offset * stepDeg;

  return {
    rotate,
    x: offset * spacing,
    y: Math.abs(rotate) * 1.9,
  };
}

export function PlayingCardFan({
  cards,
  cardWidth = 112,
  className,
  onPlay,
  playedIds: controlledPlayedIds,
}) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef(null);
  const pileTransforms = useRef(new Map());
  const [containerWidth, setContainerWidth] = useState(null);
  const [internalPlayedIds, setInternalPlayedIds] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [showHint, setShowHint] = useState(true);

  const playedIds = controlledPlayedIds ?? internalPlayedIds;

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const id of pileTransforms.current.keys()) {
      if (!playedIds.includes(id)) {
        pileTransforms.current.delete(id);
      }
    }
  }, [playedIds]);

  const handCards = cards.filter((card) => !playedIds.includes(card.id));
  const hoveredIndex = hoveredId ? handCards.findIndex((card) => card.id === hoveredId) : -1;

  const baseSpacing = handCards.length > 5 ? 48 : 58;
  const maxOffset = (handCards.length - 1) / 2;
  const halfAvailable =
    containerWidth === null ? Number.POSITIVE_INFINITY : containerWidth / 2 - cardWidth * 0.8;
  const fanSpacing =
    maxOffset > 0 ? Math.min(baseSpacing, Math.max(minFanSpacing, halfAvailable / maxOffset)) : 0;

  const cardTransition = shouldReduceMotion
    ? { duration: 0.16, ease: 'easeOut' }
    : {
        damping: 30,
        mass: 0.9,
        stiffness: 340,
        type: 'spring',
      };

  function pileTransform(id) {
    const existing = pileTransforms.current.get(id);
    if (existing) return existing;

    const created = {
      rotate: randomBetween(-13, 13),
      x: randomBetween(-14, 14),
      y: pileLift + randomBetween(-6, 6),
    };

    pileTransforms.current.set(id, created);
    return created;
  }

  function clearHover(id) {
    setHoveredId((current) => (current === id ? null : current));
  }

  function playCard(card) {
    if (playedIds.includes(card.id)) return;
    clearHover(card.id);
    setShowHint(false);

    if (controlledPlayedIds === undefined) {
      setInternalPlayedIds((current) => (current.includes(card.id) ? current : [...current, card.id]));
    }

    onPlay?.(card);
  }

  const hintCard = handCards[Math.floor((handCards.length - 1) / 2)] || handCards[0];

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} ref={containerRef}>
      {cards.map((card) => {
        const playOrder = playedIds.indexOf(card.id);
        const isPlayed = playOrder !== -1;
        const handIndex = handCards.findIndex((candidate) => candidate.id === card.id);

        let target;
        let zIndex;

        if (isPlayed) {
          const pile = pileTransform(card.id);
          target = {
            rotate: pile.rotate,
            scale: 1,
            x: pile.x,
            y: pile.y,
          };
          zIndex = 100 + playOrder;
        } else {
          const fan = fanTransform(handIndex, handCards.length, fanSpacing);
          const isHovered = card.id === hoveredId;
          const neighborShift =
            hoveredIndex !== -1 && !isHovered
              ? (Math.sign(handIndex - hoveredIndex) * 24) / Math.max(1, Math.abs(handIndex - hoveredIndex))
              : 0;

          target = {
            rotate: isHovered ? fan.rotate * 0.3 : fan.rotate,
            scale: isHovered ? 1.06 : 1,
            x: fan.x + neighborShift,
            y: isHovered ? -hoverLift : fan.y,
          };
          zIndex = isHovered ? 60 : 10 + handIndex;
        }

        return (
          <motion.div
            animate={target}
            className="absolute left-1/2"
            initial={false}
            key={card.id}
            style={{
              bottom: -bottomTuck,
              marginLeft: -cardWidth / 2,
              zIndex,
            }}
            transition={cardTransition}
          >
            <motion.button
              aria-label={
                isPlayed
                  ? `${rankNames[card.rank]} of ${card.suit}, played`
                  : `Play the ${rankNames[card.rank]} of ${card.suit}`
              }
              className={
                isPlayed
                  ? 'block cursor-default rounded-[8px] focus-visible:outline-none'
                  : 'block cursor-pointer rounded-[8px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400'
              }
              disabled={isPlayed}
              onBlur={() => clearHover(card.id)}
              onFocus={() => {
                if (!isPlayed) setHoveredId(card.id);
              }}
              onHoverEnd={() => clearHover(card.id)}
              onHoverStart={() => {
                if (!isPlayed) setHoveredId(card.id);
              }}
              onTap={() => {
                if (!isPlayed) playCard(card);
              }}
              type="button"
            >
              <PlayingCard rank={card.rank} suit={card.suit} width={cardWidth} />
            </motion.button>
          </motion.div>
        );
      })}

      {showHint && hintCard ? (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-[80] -translate-x-1/2">
          <div className="relative animate-bounce rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            Click here
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
