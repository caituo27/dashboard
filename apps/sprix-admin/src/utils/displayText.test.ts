import {expect,it} from 'vitest';
import {maskPhone} from './displayText';

it('masks phone display without changing already masked or missing values',()=>{
  expect(maskPhone('13812345678')).toBe('138****5678');
  expect(maskPhone('+86 13812345678')).toBe('+86 138****5678');
  expect(maskPhone('138 1234 5678')).toBe('138****5678');
  expect(maskPhone('138****5678')).toBe('138****5678');
  expect(maskPhone('未提供')).toBe('未提供');
  expect(maskPhone(undefined)).toBe('—');
});
