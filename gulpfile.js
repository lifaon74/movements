const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const path = require('path');

const tsProject = ts.createProject('tsconfig.json');

const SRC_DIR = 'src';
const SRC_FILES = path.join(SRC_DIR, '**', '*.ts');

gulp.task('build.js', () => {
  return gulp.src(SRC_FILES)
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', ['build.js'], () => {
  gulp.watch(SRC_FILES, ['build.js']);
});