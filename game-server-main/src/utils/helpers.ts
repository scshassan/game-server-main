import { PlacedChip, ValueType } from "../Global";

var blackNumbers = [
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 29, 28, 31, 33, 35,
];
var redNumbers = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];

export function calculateWinnings(
  winningNumber: number,
  placedChips: PlacedChip[]
) {
  console.log("calculateWinnings for number " + winningNumber);
  var win = 0;
  var arrayLength = placedChips.length;
  for (var i = 0; i < arrayLength; i++) {
    var placedChip = placedChips[i];
    var placedChipType = placedChip.item.type;
    var placedChipValue = placedChip.item.value;
    var placedChipSum = placedChip.sum;

    if (
      placedChipType === ValueType.NUMBER &&
      placedChipValue === winningNumber
    ) {
      win += placedChipSum * 36;
    } else if (
      placedChipType === ValueType.BLACK &&
      blackNumbers.includes(winningNumber)
    ) {
      // if bet on black and win
      win += placedChipSum * 2;
    } else if (
      placedChipType === ValueType.RED &&
      redNumbers.includes(winningNumber)
    ) {
      // if bet on red and win
      win += placedChipSum * 2;
    } else if (
      placedChipType === ValueType.NUMBERS_1_18 &&
      winningNumber >= 1 &&
      winningNumber <= 18
    ) {
      // if number is 1 to 18
      win += placedChipSum * 2;
    } else if (
      placedChipType === ValueType.NUMBERS_19_36 &&
      winningNumber >= 19 &&
      winningNumber <= 36
    ) {
      // if number is 19 to 36
      win += placedChipSum * 2;
    } else if (
      placedChipType === ValueType.NUMBERS_1_12 &&
      winningNumber >= 1 &&
      winningNumber <= 12
    ) {
      // if number is within range of row1
      win += placedChipSum * 3;
    } else if (
      placedChipType === ValueType.NUMBERS_2_12 &&
      winningNumber >= 13 &&
      winningNumber <= 24
    ) {
      // if number is within range of row2
      win += placedChipSum * 3;
    } else if (
      placedChipType === ValueType.NUMBERS_3_12 &&
      winningNumber >= 25 &&
      winningNumber <= 36
    ) {
      // if number is within range of row3
      win += placedChipSum * 3;
    } else if (
      placedChipType === ValueType.EVEN ||
      placedChipType === ValueType.ODD
    ) {
      if (winningNumber % 2 == 0) {
        // if number even
        win += placedChipSum * 2;
      } else {
        // if number is odd
        win += placedChipSum * 2;
      }
    }
  }

  return win;
}
