import { PROMPT_PLACEHOLDER } from "./examples";
import { ArrowUpIcon } from "./icons";

export function PromptBox({ defaultValue = "", id = "q" }: { defaultValue?: string; id?: string }) {
  return (
    <form action="/search" method="get" role="search" className="w-full">
      <label htmlFor={id} className="sr-only">
        Describe what you want from a bank
      </label>
      <div className="prompt">
        <input
          id={id}
          name="q"
          type="text"
          defaultValue={defaultValue}
          placeholder={PROMPT_PLACEHOLDER}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="prompt-go">
          <ArrowUpIcon />
          <span className="sr-only">Find offers</span>
        </button>
      </div>
    </form>
  );
}
