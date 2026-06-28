import { AppModule } from "../src/app.module";

describe("api migration smoke", () => {
  it("loads the Nest application module", () => {
    expect(AppModule).toBeDefined();
  });
});
