const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const path = require('path');
const browserify = require('browserify');
const source = require('vinyl-source-stream');


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

gulp.task('browserify', ['build.js'], function() {
  return browserify('dist/movement.js')
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('bundle'));
});

gulp.task('watch', [
  'build.js',
  // 'browserify'
], () => {
  gulp.watch(SRC_FILES, [
    'build.js',
    // 'browserify'
]);
});

