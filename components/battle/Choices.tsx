import styles from "./battle.module.css";

type Props = {
  legend: string;
  options: readonly string[];
  selected: number | null;
  onPick: (index: number) => void;
  isLocked?: boolean;
};

/** A labelled group of large tap-target options; the chosen one is marked with aria-pressed. */
export function Choices({ legend, options, selected, onPick, isLocked = false }: Props) {
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((option, i) => (
        <button
          key={option}
          type="button"
          className={styles.option}
          aria-pressed={selected === i}
          disabled={isLocked}
          onClick={() => onPick(i)}
        >
          {option}
        </button>
      ))}
    </fieldset>
  );
}
