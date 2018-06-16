import { Component } from 'preact';
import styles from './controls-weights.css';
import { times } from './utils';

export class WeightsControls extends Component {
  state = {
    weightType: 'percentage',
    weights: this.getWeightsFor(this.props),
  };

  getWeightsFor(props, state = this.state) {
    if (!state.weights) {
      state.weights = [];
    };
    return times(props.high - props.low + 1, (n) => ({
      label: n + props.low - 1,
      value: state.weights[n - 1] ? state.weights[n - 1].value : 1,
    }));
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.low !== this.props.low || nextProps.high !== this.props.high) {
      this.setState({
        weights: this.getWeightsFor(nextProps),
      });
    }
  }

  setWeight(index, value) {
    this.state.weights[index].value = value;
    this.forceUpdate();
  }

  render() {
    const {
      hidden,
    } = this.props;
    const totalWeight = this.state.weights.reduce((total, weight) => total + weight.value, 0);
    const percentages = this.state.weights.map(weight => {
      return weight.value ? (100 * weight.value / totalWeight).toFixed(0) : 0;
    });

    return (
      <section className={hidden ? styles.hidden : styles.weights}>
        <p>
          Integers only. {
            this.state.weightType === 'percentage' ?
            'Set a fixed probability that charts of each difficulty level will be drawn.' :
            'Adds extra copies of charts of each difficulty to the deck from which charts are drawn. (Probability is based on total number of charts of selected difficulties.)'
          }
        </p>
        {/* <select value={this.state.weightType}>
          <option value="percentage">Percentage</option>
          <option value="multiplier">Multiplier</option>
        </select> */}
        {this.state.weights.map((weight, i) => {
          return (
            <label key={weight.label}>
              <input
                type="number"
                name={`weight-${weight.label}`}
                value={weight.value}
                min="0"
                onChange={(e) => this.setWeight(i, +e.currentTarget.value)}
              />
              {weight.label} <sub>{percentages[i]}%</sub>
            </label>
          );
        })}
      </section>
    );
  }
}