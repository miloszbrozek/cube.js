cube(`Donors`, {
  sql: `
    SELECT * FROM test.donors
  `,

  measures: {
    count: {
      type: `count`
    },
  },

  dimensions: {
    donorCity: {
      sql: `"Donor City"`,
      type: `string`
    },
    donorState: {
      sql: `"Donor State"`,
      type: `string`
    },
    donorIsTeacher: {
      sql: `"Donor Is Teacher"`,
      type: `string`
    },
    donorZip: {
      sql: `"Donor Zip"`,
      type: `string`
    }
  }
});
