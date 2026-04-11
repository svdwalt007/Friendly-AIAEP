import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IotUi } from './iot-ui';

describe('IotUi', () => {
  let component: IotUi;
  let fixture: ComponentFixture<IotUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IotUi],
    }).compileComponents();

    fixture = TestBed.createComponent(IotUi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
