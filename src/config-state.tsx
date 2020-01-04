import { createContext, Component, Context } from "preact";

export interface ConfigState {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  weights: number[];
  forceDistribution: boolean;
  style: string;
  difficulties: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  update(mutator: (state: ConfigState) => ConfigState): void;
}

export const ConfigStateContext = (createContext(null) as unknown) as Context<
  ConfigState
>;

interface Props {}

export class ConfigStateManager extends Component<Props, ConfigState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      chartCount: 5,
      upperBound: 0,
      lowerBound: 0,
      useWeights: false,
      weights: [],
      forceDistribution: true,
      style: "",
      difficulties: new Set(),
      flags: new Set(),
      update: this.update
    };
  }

  public render() {
    return (
      <ConfigStateContext.Provider value={this.state}>
        {this.props.children}
      </ConfigStateContext.Provider>
    );
  }

  private update = (mutator: (state: ConfigState) => ConfigState) => {
    this.setState(mutator);
  };
}
