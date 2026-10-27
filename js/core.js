'use strict';
// Общие помощники: выбор элементов, случайные числа, константы времени
const $ = (s) => document.querySelector(s);
const HOUR_MS = 2600;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
