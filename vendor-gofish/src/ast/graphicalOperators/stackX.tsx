import { stack } from "./stack";

export const stackX = (
  ...args: any[]
): ReturnType<typeof stack> => {
  if (args.length === 2) {
    const [props, children] = args;
    return stack(
      {
        ...props,
        direction: "x",
      },
      children
    );
  } else if (args.length === 1) {
    const [children] = args;
    return stack(
      {
        direction: "x",
      },
      children
    );
  } else {
    return stack({
      direction: "x",
    });
  }
};
