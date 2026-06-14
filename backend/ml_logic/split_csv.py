import argparse
import os
import sys
import random
import csv

try:
    import pandas as pd
    _HAS_PANDAS = True
except Exception:
    _HAS_PANDAS = False


def split_with_pandas(input_path, train_path, test_path, train_frac, seed):
    df = pd.read_csv(input_path)
    df_shuffled = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    n_train = int(len(df_shuffled) * train_frac)
    df_shuffled.iloc[:n_train].to_csv(train_path, index=False)
    df_shuffled.iloc[n_train:].to_csv(test_path, index=False)


def split_without_pandas(input_path, train_path, test_path, train_frac, seed):
    with open(input_path, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        raise SystemExit('Input CSV is empty')
    header, data = rows[0], rows[1:]
    random.Random(seed).shuffle(data)
    n_train = int(len(data) * train_frac)
    train_rows = [header] + data[:n_train]
    test_rows = [header] + data[n_train:]
    with open(train_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(train_rows)
    with open(test_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(test_rows)


def make_default_paths(input_path):
    base, ext = os.path.splitext(os.path.basename(input_path))
    train_name = f"{base}_train{ext}"
    test_name = f"{base}_test{ext}"
    dirpath = os.path.dirname(input_path) or os.getcwd()
    return os.path.join(dirpath, train_name), os.path.join(dirpath, test_name)


def main():
    p = argparse.ArgumentParser(description='Split CSV into train/test (80/20 default)')
    p.add_argument('input_csv', help='Path to input CSV file')
    p.add_argument('--train-frac', type=float, default=0.8, help='Fraction for training set (default: 0.8)')
    p.add_argument('--seed', type=int, default=42, help='Random seed (default: 42)')
    p.add_argument('--train-out', help='Output path for train CSV (optional)')
    p.add_argument('--test-out', help='Output path for test CSV (optional)')
    args = p.parse_args()

    inp = args.input_csv
    if not os.path.isfile(inp):
        print(f'Input file not found: {inp}', file=sys.stderr)
        sys.exit(2)

    train_out = args.train_out or make_default_paths(inp)[0]
    test_out = args.test_out or make_default_paths(inp)[1]

    if _HAS_PANDAS:
        split_with_pandas(inp, train_out, test_out, args.train_frac, args.seed)
    else:
        split_without_pandas(inp, train_out, test_out, args.train_frac, args.seed)

    print(f'Wrote train -> {train_out}')
    print(f'Wrote test  -> {test_out}')


if __name__ == '__main__':
    main()
