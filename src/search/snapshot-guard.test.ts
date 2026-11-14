import { expect, it } from 'vitest';
import { solve } from '../index.js';
import { openCorridorMaze, isolatedGoalMaze, comparisonMaze } from '../model/fixtures.js';
import type { SolverId } from '../model/wall-maze.js';
import { recursiveBacktracker } from '../generate/recursive-backtracker.js';

// Captured on unchanged main (7b71a15). Never regenerate events or paths.
it('pins bfs full trace and result for comparisonMaze', () => {
  expect(solve(comparisonMaze, 'bfs' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      19,
      24
    ],
    "exploredCount": 25,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 5
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 6
    },
    {
      "type": "visit",
      "node": 5
    },
    {
      "type": "frontier-add",
      "node": 10
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 7
    },
    {
      "type": "visit",
      "node": 6
    },
    {
      "type": "frontier-add",
      "node": 11
    },
    {
      "type": "visit",
      "node": 10
    },
    {
      "type": "frontier-add",
      "node": 15
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 8
    },
    {
      "type": "visit",
      "node": 7
    },
    {
      "type": "frontier-add",
      "node": 12
    },
    {
      "type": "visit",
      "node": 11
    },
    {
      "type": "frontier-add",
      "node": 16
    },
    {
      "type": "visit",
      "node": 15
    },
    {
      "type": "frontier-add",
      "node": 20
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 8
    },
    {
      "type": "frontier-add",
      "node": 13
    },
    {
      "type": "visit",
      "node": 12
    },
    {
      "type": "frontier-add",
      "node": 17
    },
    {
      "type": "visit",
      "node": 16
    },
    {
      "type": "frontier-add",
      "node": 21
    },
    {
      "type": "visit",
      "node": 20
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 13
    },
    {
      "type": "frontier-add",
      "node": 18
    },
    {
      "type": "visit",
      "node": 17
    },
    {
      "type": "frontier-add",
      "node": 22
    },
    {
      "type": "visit",
      "node": 21
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "visit",
      "node": 18
    },
    {
      "type": "frontier-add",
      "node": 23
    },
    {
      "type": "visit",
      "node": 22
    },
    {
      "type": "visit",
      "node": 19
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "visit",
      "node": 23
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "path",
      "path": [
        0,
        1,
        2,
        3,
        4,
        9,
        14,
        19,
        24
      ]
    }
  ]
});
});

it('pins astar full trace and result for comparisonMaze', () => {
  expect(solve(comparisonMaze, 'astar' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      19,
      24
    ],
    "exploredCount": 9,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 5
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 6
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 7
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 8
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "frontier-add",
      "node": 13
    },
    {
      "type": "visit",
      "node": 19
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "frontier-add",
      "node": 18
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "path",
      "path": [
        0,
        1,
        2,
        3,
        4,
        9,
        14,
        19,
        24
      ]
    }
  ]
});
});

it('pins bfs full trace and result for isolatedGoalMaze', () => {
  expect(solve(isolatedGoalMaze, 'bfs' as SolverId)).toEqual({
  "result": {
    "outcome": "unreachable",
    "path": [],
    "exploredCount": 8,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "visit",
      "node": 19
    }
  ]
});
});

it('pins astar full trace and result for isolatedGoalMaze', () => {
  expect(solve(isolatedGoalMaze, 'astar' as SolverId)).toEqual({
  "result": {
    "outcome": "unreachable",
    "path": [],
    "exploredCount": 8,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "visit",
      "node": 19
    }
  ]
});
});

it('pins bfs full trace and result for openCorridorMaze', () => {
  expect(solve(openCorridorMaze, 'bfs' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      19,
      24
    ],
    "exploredCount": 9,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "visit",
      "node": 19
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "path",
      "path": [
        0,
        1,
        2,
        3,
        4,
        9,
        14,
        19,
        24
      ]
    }
  ]
});
});

it('pins astar full trace and result for openCorridorMaze', () => {
  expect(solve(openCorridorMaze, 'astar' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      19,
      24
    ],
    "exploredCount": 9,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 3
    },
    {
      "type": "visit",
      "node": 3
    },
    {
      "type": "frontier-add",
      "node": 4
    },
    {
      "type": "visit",
      "node": 4
    },
    {
      "type": "frontier-add",
      "node": 9
    },
    {
      "type": "visit",
      "node": 9
    },
    {
      "type": "frontier-add",
      "node": 14
    },
    {
      "type": "visit",
      "node": 14
    },
    {
      "type": "frontier-add",
      "node": 19
    },
    {
      "type": "visit",
      "node": 19
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "path",
      "path": [
        0,
        1,
        2,
        3,
        4,
        9,
        14,
        19,
        24
      ]
    }
  ]
});
});

it('pins bfs full trace and result for cornrow', () => {
  expect(solve(recursiveBacktracker({ seed: 'cornrow', rows: 10, cols: 10 }).environment, 'bfs' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      10,
      20,
      30,
      40,
      41,
      31,
      21,
      11,
      1,
      2,
      12,
      22,
      32,
      33,
      34,
      24,
      25,
      26,
      36,
      35,
      45,
      46,
      47,
      57,
      67,
      77,
      76,
      75,
      85,
      84,
      74,
      73,
      83,
      93,
      94,
      95,
      96,
      97,
      87,
      88,
      89,
      99
    ],
    "exploredCount": 52,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 10
    },
    {
      "type": "visit",
      "node": 10
    },
    {
      "type": "frontier-add",
      "node": 20
    },
    {
      "type": "visit",
      "node": 20
    },
    {
      "type": "frontier-add",
      "node": 30
    },
    {
      "type": "visit",
      "node": 30
    },
    {
      "type": "frontier-add",
      "node": 40
    },
    {
      "type": "visit",
      "node": 40
    },
    {
      "type": "frontier-add",
      "node": 41
    },
    {
      "type": "visit",
      "node": 41
    },
    {
      "type": "frontier-add",
      "node": 31
    },
    {
      "type": "visit",
      "node": 31
    },
    {
      "type": "frontier-add",
      "node": 21
    },
    {
      "type": "visit",
      "node": 21
    },
    {
      "type": "frontier-add",
      "node": 11
    },
    {
      "type": "visit",
      "node": 11
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 12
    },
    {
      "type": "visit",
      "node": 12
    },
    {
      "type": "frontier-add",
      "node": 22
    },
    {
      "type": "visit",
      "node": 22
    },
    {
      "type": "frontier-add",
      "node": 32
    },
    {
      "type": "visit",
      "node": 32
    },
    {
      "type": "frontier-add",
      "node": 33
    },
    {
      "type": "visit",
      "node": 33
    },
    {
      "type": "frontier-add",
      "node": 34
    },
    {
      "type": "visit",
      "node": 34
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "frontier-add",
      "node": 25
    },
    {
      "type": "visit",
      "node": 25
    },
    {
      "type": "frontier-add",
      "node": 26
    },
    {
      "type": "visit",
      "node": 26
    },
    {
      "type": "frontier-add",
      "node": 36
    },
    {
      "type": "visit",
      "node": 36
    },
    {
      "type": "frontier-add",
      "node": 35
    },
    {
      "type": "visit",
      "node": 35
    },
    {
      "type": "frontier-add",
      "node": 45
    },
    {
      "type": "visit",
      "node": 45
    },
    {
      "type": "frontier-add",
      "node": 46
    },
    {
      "type": "visit",
      "node": 46
    },
    {
      "type": "frontier-add",
      "node": 47
    },
    {
      "type": "visit",
      "node": 47
    },
    {
      "type": "frontier-add",
      "node": 57
    },
    {
      "type": "visit",
      "node": 57
    },
    {
      "type": "frontier-add",
      "node": 67
    },
    {
      "type": "visit",
      "node": 67
    },
    {
      "type": "frontier-add",
      "node": 77
    },
    {
      "type": "visit",
      "node": 77
    },
    {
      "type": "frontier-add",
      "node": 76
    },
    {
      "type": "visit",
      "node": 76
    },
    {
      "type": "frontier-add",
      "node": 75
    },
    {
      "type": "visit",
      "node": 75
    },
    {
      "type": "frontier-add",
      "node": 85
    },
    {
      "type": "visit",
      "node": 85
    },
    {
      "type": "frontier-add",
      "node": 84
    },
    {
      "type": "visit",
      "node": 84
    },
    {
      "type": "frontier-add",
      "node": 74
    },
    {
      "type": "visit",
      "node": 74
    },
    {
      "type": "frontier-add",
      "node": 73
    },
    {
      "type": "visit",
      "node": 73
    },
    {
      "type": "frontier-add",
      "node": 83
    },
    {
      "type": "visit",
      "node": 83
    },
    {
      "type": "frontier-add",
      "node": 93
    },
    {
      "type": "visit",
      "node": 93
    },
    {
      "type": "frontier-add",
      "node": 94
    },
    {
      "type": "frontier-add",
      "node": 92
    },
    {
      "type": "visit",
      "node": 94
    },
    {
      "type": "frontier-add",
      "node": 95
    },
    {
      "type": "visit",
      "node": 92
    },
    {
      "type": "frontier-add",
      "node": 91
    },
    {
      "type": "visit",
      "node": 95
    },
    {
      "type": "frontier-add",
      "node": 96
    },
    {
      "type": "visit",
      "node": 91
    },
    {
      "type": "frontier-add",
      "node": 90
    },
    {
      "type": "visit",
      "node": 96
    },
    {
      "type": "frontier-add",
      "node": 97
    },
    {
      "type": "visit",
      "node": 90
    },
    {
      "type": "frontier-add",
      "node": 80
    },
    {
      "type": "visit",
      "node": 97
    },
    {
      "type": "frontier-add",
      "node": 87
    },
    {
      "type": "visit",
      "node": 80
    },
    {
      "type": "frontier-add",
      "node": 70
    },
    {
      "type": "visit",
      "node": 87
    },
    {
      "type": "frontier-add",
      "node": 88
    },
    {
      "type": "frontier-add",
      "node": 86
    },
    {
      "type": "visit",
      "node": 70
    },
    {
      "type": "frontier-add",
      "node": 60
    },
    {
      "type": "visit",
      "node": 88
    },
    {
      "type": "frontier-add",
      "node": 89
    },
    {
      "type": "visit",
      "node": 86
    },
    {
      "type": "visit",
      "node": 60
    },
    {
      "type": "frontier-add",
      "node": 61
    },
    {
      "type": "visit",
      "node": 89
    },
    {
      "type": "frontier-add",
      "node": 79
    },
    {
      "type": "frontier-add",
      "node": 99
    },
    {
      "type": "visit",
      "node": 61
    },
    {
      "type": "frontier-add",
      "node": 71
    },
    {
      "type": "visit",
      "node": 79
    },
    {
      "type": "frontier-add",
      "node": 78
    },
    {
      "type": "visit",
      "node": 99
    },
    {
      "type": "path",
      "path": [
        0,
        10,
        20,
        30,
        40,
        41,
        31,
        21,
        11,
        1,
        2,
        12,
        22,
        32,
        33,
        34,
        24,
        25,
        26,
        36,
        35,
        45,
        46,
        47,
        57,
        67,
        77,
        76,
        75,
        85,
        84,
        74,
        73,
        83,
        93,
        94,
        95,
        96,
        97,
        87,
        88,
        89,
        99
      ]
    }
  ]
});
});

it('pins astar full trace and result for cornrow', () => {
  expect(solve(recursiveBacktracker({ seed: 'cornrow', rows: 10, cols: 10 }).environment, 'astar' as SolverId)).toEqual({
  "result": {
    "outcome": "found",
    "path": [
      0,
      10,
      20,
      30,
      40,
      41,
      31,
      21,
      11,
      1,
      2,
      12,
      22,
      32,
      33,
      34,
      24,
      25,
      26,
      36,
      35,
      45,
      46,
      47,
      57,
      67,
      77,
      76,
      75,
      85,
      84,
      74,
      73,
      83,
      93,
      94,
      95,
      96,
      97,
      87,
      88,
      89,
      99
    ],
    "exploredCount": 43,
    "space": "discrete-graph"
  },
  "events": [
    {
      "type": "frontier-add",
      "node": 0
    },
    {
      "type": "visit",
      "node": 0
    },
    {
      "type": "frontier-add",
      "node": 10
    },
    {
      "type": "visit",
      "node": 10
    },
    {
      "type": "frontier-add",
      "node": 20
    },
    {
      "type": "visit",
      "node": 20
    },
    {
      "type": "frontier-add",
      "node": 30
    },
    {
      "type": "visit",
      "node": 30
    },
    {
      "type": "frontier-add",
      "node": 40
    },
    {
      "type": "visit",
      "node": 40
    },
    {
      "type": "frontier-add",
      "node": 41
    },
    {
      "type": "visit",
      "node": 41
    },
    {
      "type": "frontier-add",
      "node": 31
    },
    {
      "type": "visit",
      "node": 31
    },
    {
      "type": "frontier-add",
      "node": 21
    },
    {
      "type": "visit",
      "node": 21
    },
    {
      "type": "frontier-add",
      "node": 11
    },
    {
      "type": "visit",
      "node": 11
    },
    {
      "type": "frontier-add",
      "node": 1
    },
    {
      "type": "visit",
      "node": 1
    },
    {
      "type": "frontier-add",
      "node": 2
    },
    {
      "type": "visit",
      "node": 2
    },
    {
      "type": "frontier-add",
      "node": 12
    },
    {
      "type": "visit",
      "node": 12
    },
    {
      "type": "frontier-add",
      "node": 22
    },
    {
      "type": "visit",
      "node": 22
    },
    {
      "type": "frontier-add",
      "node": 32
    },
    {
      "type": "visit",
      "node": 32
    },
    {
      "type": "frontier-add",
      "node": 33
    },
    {
      "type": "visit",
      "node": 33
    },
    {
      "type": "frontier-add",
      "node": 34
    },
    {
      "type": "visit",
      "node": 34
    },
    {
      "type": "frontier-add",
      "node": 24
    },
    {
      "type": "visit",
      "node": 24
    },
    {
      "type": "frontier-add",
      "node": 25
    },
    {
      "type": "visit",
      "node": 25
    },
    {
      "type": "frontier-add",
      "node": 26
    },
    {
      "type": "visit",
      "node": 26
    },
    {
      "type": "frontier-add",
      "node": 36
    },
    {
      "type": "visit",
      "node": 36
    },
    {
      "type": "frontier-add",
      "node": 35
    },
    {
      "type": "visit",
      "node": 35
    },
    {
      "type": "frontier-add",
      "node": 45
    },
    {
      "type": "visit",
      "node": 45
    },
    {
      "type": "frontier-add",
      "node": 46
    },
    {
      "type": "visit",
      "node": 46
    },
    {
      "type": "frontier-add",
      "node": 47
    },
    {
      "type": "visit",
      "node": 47
    },
    {
      "type": "frontier-add",
      "node": 57
    },
    {
      "type": "visit",
      "node": 57
    },
    {
      "type": "frontier-add",
      "node": 67
    },
    {
      "type": "visit",
      "node": 67
    },
    {
      "type": "frontier-add",
      "node": 77
    },
    {
      "type": "visit",
      "node": 77
    },
    {
      "type": "frontier-add",
      "node": 76
    },
    {
      "type": "visit",
      "node": 76
    },
    {
      "type": "frontier-add",
      "node": 75
    },
    {
      "type": "visit",
      "node": 75
    },
    {
      "type": "frontier-add",
      "node": 85
    },
    {
      "type": "visit",
      "node": 85
    },
    {
      "type": "frontier-add",
      "node": 84
    },
    {
      "type": "visit",
      "node": 84
    },
    {
      "type": "frontier-add",
      "node": 74
    },
    {
      "type": "visit",
      "node": 74
    },
    {
      "type": "frontier-add",
      "node": 73
    },
    {
      "type": "visit",
      "node": 73
    },
    {
      "type": "frontier-add",
      "node": 83
    },
    {
      "type": "visit",
      "node": 83
    },
    {
      "type": "frontier-add",
      "node": 93
    },
    {
      "type": "visit",
      "node": 93
    },
    {
      "type": "frontier-add",
      "node": 94
    },
    {
      "type": "frontier-add",
      "node": 92
    },
    {
      "type": "visit",
      "node": 94
    },
    {
      "type": "frontier-add",
      "node": 95
    },
    {
      "type": "visit",
      "node": 95
    },
    {
      "type": "frontier-add",
      "node": 96
    },
    {
      "type": "visit",
      "node": 96
    },
    {
      "type": "frontier-add",
      "node": 97
    },
    {
      "type": "visit",
      "node": 97
    },
    {
      "type": "frontier-add",
      "node": 87
    },
    {
      "type": "visit",
      "node": 87
    },
    {
      "type": "frontier-add",
      "node": 88
    },
    {
      "type": "frontier-add",
      "node": 86
    },
    {
      "type": "visit",
      "node": 88
    },
    {
      "type": "frontier-add",
      "node": 89
    },
    {
      "type": "visit",
      "node": 89
    },
    {
      "type": "frontier-add",
      "node": 79
    },
    {
      "type": "frontier-add",
      "node": 99
    },
    {
      "type": "visit",
      "node": 99
    },
    {
      "type": "path",
      "path": [
        0,
        10,
        20,
        30,
        40,
        41,
        31,
        21,
        11,
        1,
        2,
        12,
        22,
        32,
        33,
        34,
        24,
        25,
        26,
        36,
        35,
        45,
        46,
        47,
        57,
        67,
        77,
        76,
        75,
        85,
        84,
        74,
        73,
        83,
        93,
        94,
        95,
        96,
        97,
        87,
        88,
        89,
        99
      ]
    }
  ]
});
});
