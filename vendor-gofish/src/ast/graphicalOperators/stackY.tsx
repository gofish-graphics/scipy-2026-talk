import { stack } from "./stack";

export const stackY = (
  ...args: any[]
): ReturnType<typeof stack> => {
  if (args.length === 2) {
    const [props, children] = args;
    return stack(
      {
        ...props,
        direction: "y",
      },
      children
    );
  } else if (args.length === 1) {
    const [children] = args;
    return stack(
      {
        direction: "y",
      },
      children
    );
  } else {
    return stack({
      direction: "y",
    });
  }
};
